import { SearchOptions, SearchProvider, SearchResultItem } from "../types";
import { request } from "undici";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import prisma from "../prisma";

/**
 * SerpAPI implementation with Google engine, 24h DB caching, and account quota checking
 */
export class SerpApiProvider implements SearchProvider {
  name = "SerpAPI";
  private apiKey: string;
  private defaultTbs: string;

  constructor(apiKey?: string) {
    this.apiKey =
      apiKey ||
      process.env.SERPAPI_API_KEY ||
      process.env.SEARCH_API_KEY ||
      "";
    this.defaultTbs = process.env.SERPAPI_TBS || "qdr:m"; // Default: past month for freshness
  }

  /**
   * Check remaining searches on the SerpAPI account endpoint
   */
  async getRemainingQuota(): Promise<number | null> {
    if (!this.apiKey) return null;

    try {
      const endpoint = new URL("https://serpapi.com/account.json");
      endpoint.searchParams.set("api_key", this.apiKey);

      const res = await request(endpoint.toString(), {
        method: "GET",
        headersTimeout: 10000,
      });

      if (res.statusCode !== 200) {
        console.warn(`[SerpAPI] Failed to fetch account quota. Status: ${res.statusCode}`);
        return null;
      }

      const data = (await res.body.json()) as any;
      const searchesLeft =
        data.total_searches_left ?? data.plan_searches_left ?? null;

      return searchesLeft !== null ? Number(searchesLeft) : null;
    } catch (err: any) {
      console.warn("[SerpAPI] Error querying account quota:", err.message || err);
      return null;
    }
  }

  /**
   * Performs search with Google engine on SerpAPI, reading organic_results and caching to DB for 24h
   */
  async search(
    query: string,
    opts?: SearchOptions | number
  ): Promise<SearchResultItem[]> {
    if (!this.apiKey) {
      throw new Error("SerpAPI requires SERPAPI_API_KEY or SEARCH_API_KEY in environment");
    }

    const options: SearchOptions =
      typeof opts === "number" ? { limit: opts } : opts || {};

    const limit = options.limit || 10;
    const offset = options.offset || 0;
    const hl = options.hl || "en";
    const gl = options.gl || "us";
    const tbs = options.tbs || this.defaultTbs;

    // 1. Compute deterministic cache key for query + parameters
    const cacheParams = {
      engine: "google",
      query,
      num: limit,
      start: offset,
      hl,
      gl,
      tbs,
    };
    const cacheKey = crypto
      .createHash("sha256")
      .update(JSON.stringify(cacheParams))
      .digest("hex");

    // 2. Check 24-hour database cache
    try {
      const cached = await prisma.searchCache.findUnique({
        where: { cacheKey },
      });

      if (cached && cached.expiresAt > new Date()) {
        const results = JSON.parse(cached.results) as SearchResultItem[];
        console.log(`[SerpAPI] Cache HIT for query: "${query}" (start=${offset}, ${results.length} results)`);
        return results;
      }
    } catch (dbErr) {
      // If DB read fails, continue to fetch from SerpAPI
      console.warn("[SerpAPI] Cache lookup warning:", dbErr);
    }

    // 3. Query SerpAPI
    console.log(`[SerpAPI] Executing live search: "${query}" (start=${offset}, tbs=${tbs})...`);
    const endpoint = new URL("https://serpapi.com/search.json");
    endpoint.searchParams.set("engine", "google");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("api_key", this.apiKey);
    endpoint.searchParams.set("num", limit.toString());
    endpoint.searchParams.set("hl", hl);
    endpoint.searchParams.set("gl", gl);
    endpoint.searchParams.set("start", offset.toString());

    if (tbs) {
      endpoint.searchParams.set("tbs", tbs);
    }

    const res = await request(endpoint.toString(), {
      method: "GET",
      headersTimeout: 30000,
      bodyTimeout: 30000,
    });

    if (res.statusCode !== 200) {
      const errText = await res.body.text();
      throw new Error(`SerpAPI error (${res.statusCode}): ${errText}`);
    }

    const data = (await res.body.json()) as any;
    const organic = data.organic_results || [];

    // Filter organic results: read title, link, snippet, date, displayed_link; ignore ads/related
    const results: SearchResultItem[] = organic
      .filter((item: any) => item && item.link)
      .map((item: any) => ({
        url: item.link,
        title: item.title || "",
        snippet: item.snippet || item.snippet_highlighted_words?.join(" ") || "",
        date: item.date,
        displayedLink: item.displayed_link,
      }));

    // 4. Save results to 24-hour database cache
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      await prisma.searchCache.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          query,
          results: JSON.stringify(results),
          expiresAt,
        },
        update: {
          results: JSON.stringify(results),
          expiresAt,
        },
      });
    } catch (cacheWriteErr) {
      console.warn("[SerpAPI] Error writing cache entry:", cacheWriteErr);
    }

    return results;
  }
}

/**
 * Google Programmable Search API (Custom Search Engine)
 */
export class GoogleSearchProvider implements SearchProvider {
  name = "Google Programmable Search";
  private apiKey: string;
  private cseId: string;

  constructor(apiKey?: string, cseId?: string) {
    this.apiKey = apiKey || process.env.SEARCH_API_KEY || "";
    this.cseId = cseId || process.env.GOOGLE_CSE_ID || "";
  }

  async search(
    query: string,
    opts?: SearchOptions | number
  ): Promise<SearchResultItem[]> {
    if (!this.apiKey || !this.cseId) {
      throw new Error(
        "Google Programmable Search requires SEARCH_API_KEY and GOOGLE_CSE_ID"
      );
    }

    const limit = typeof opts === "number" ? opts : opts?.limit || 10;
    const endpoint = new URL("https://www.googleapis.com/customsearch/v1");
    endpoint.searchParams.set("key", this.apiKey);
    endpoint.searchParams.set("cx", this.cseId);
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("num", Math.min(limit, 10).toString());

    const res = await request(endpoint.toString(), { method: "GET" });
    if (res.statusCode !== 200) {
      const errText = await res.body.text();
      throw new Error(`Google Search API error (${res.statusCode}): ${errText}`);
    }

    const data = (await res.body.json()) as any;
    const items = data.items || [];

    return items.map((item: any) => ({
      url: item.link,
      title: item.title,
      snippet: item.snippet,
    }));
  }
}

/**
 * Brave Search API implementation
 */
export class BraveSearchProvider implements SearchProvider {
  name = "Brave Search";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SEARCH_API_KEY || "";
  }

  async search(
    query: string,
    opts?: SearchOptions | number
  ): Promise<SearchResultItem[]> {
    if (!this.apiKey) {
      throw new Error("Brave Search requires SEARCH_API_KEY");
    }

    const limit = typeof opts === "number" ? opts : opts?.limit || 10;
    const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("count", Math.min(limit, 20).toString());

    const res = await request(endpoint.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": this.apiKey,
      },
    });

    if (res.statusCode !== 200) {
      const errText = await res.body.text();
      throw new Error(`Brave Search error (${res.statusCode}): ${errText}`);
    }

    const data = (await res.body.json()) as any;
    const webResults = data.web?.results || [];

    return webResults.map((item: any) => ({
      url: item.url,
      title: item.title,
      snippet: item.description,
    }));
  }
}

/**
 * Mock Search Provider for testing, local offline development, and zero-API-key demonstrations
 */
export class MockSearchProvider implements SearchProvider {
  name = "Mock Search Provider";

  private mockCandidates: SearchResultItem[] = [
    {
      url: "https://www.datadoghq.com/reviews/g2-incentive-giftcard",
      title: "Write an honest review of Datadog on G2 and receive a $25 Amazon gift card",
      snippet:
        "Current customers who complete an approved, verified review on G2 will receive a $25 Amazon.com e-gift card. First 50 reviews only. Must use corporate email.",
    },
    {
      url: "https://asana.com/community/capterra-review-rewards-program",
      title: "Asana Community: Share your Capterra Review & Claim $30 Visa Card",
      snippet:
        "Help prospective teams by reviewing Asana on Capterra. We are giving a $30 prepaid Visa card to verified users who publish a detailed review this month.",
    },
    {
      url: "https://sentry.io/review-rewards-trustradius",
      title: "Review Sentry on TrustRadius - Get $25 UberEats or Amazon Card",
      snippet:
        "We love developer feedback! Review Sentry on TrustRadius and earn a $25 reward of your choice. Valid until next month or until 100 entries.",
    },
    {
      url: "https://clickup.com/promotions/gartner-peer-insights-25",
      title: "ClickUp on Gartner Peer Insights - $25 Gift Card Incentive",
      snippet:
        "Review ClickUp on Gartner Peer Insights. As part of Gartner's verified reviewer program, qualified reviewers receive a $25 Visa gift card.",
    },
    {
      url: "https://hubspot.com/rewards/leave-a-review-g2",
      title: "HubSpot Review Program - $25 Amazon Gift Card",
      snippet:
        "Review HubSpot Marketing Hub on G2 and claim a $25 Amazon card. Program has ended for this quarter, thank you to all participants.",
    },
    {
      url: "https://airtable.com/lp/software-advice-review-giftcard",
      title: "Airtable on Software Advice: Share your thoughts & get $25",
      snippet:
        "Submit your software review on Software Advice and receive a $25 gift card. Open to active team workspace owners.",
    },
    {
      url: "https://monday.com/lp/capterra-gift-card-incentive",
      title: "Review monday.com Work OS on Capterra - $25 Amazon Reward",
      snippet:
        "Write an honest evaluation on Capterra. Valid for active enterprise and pro accounts. Get a $25 digital gift card.",
    },
    {
      url: "https://zoom.us/promo/trustradius-verified-review",
      title: "Zoom Workplace Review Initiative on TrustRadius",
      snippet:
        "Share your hybrid work experience with Zoom on TrustRadius. Receive $20 Visa gift card upon verification.",
    },
  ];

  async search(
    query: string,
    opts?: SearchOptions | number
  ): Promise<SearchResultItem[]> {
    const limit = typeof opts === "number" ? opts : opts?.limit || 10;
    const qLower = query.toLowerCase();
    const matches = this.mockCandidates.filter(
      (item) =>
        item.title.toLowerCase().includes(qLower) ||
        item.snippet?.toLowerCase().includes(qLower) ||
        (qLower.includes("g2") && item.url.includes("g2")) ||
        (qLower.includes("capterra") && item.url.includes("capterra")) ||
        (qLower.includes("trustradius") && item.url.includes("trustradius")) ||
        (qLower.includes("gartner") && item.url.includes("gartner"))
    );

    const results = matches.length > 0 ? matches : this.mockCandidates;
    return results.slice(0, limit);
  }

  async getRemainingQuota(): Promise<number | null> {
    return 1000;
  }
}

/**
 * Provider factory based on SEARCH_PROVIDER env var
 */
export function getSearchProvider(): SearchProvider {
  const provider = (process.env.SEARCH_PROVIDER || "serpapi").toLowerCase();

  switch (provider) {
    case "serpapi":
      return new SerpApiProvider();
    case "google":
      return new GoogleSearchProvider();
    case "brave":
      return new BraveSearchProvider();
    case "mock":
      return new MockSearchProvider();
    default:
      return new SerpApiProvider();
  }
}

/**
 * Generate configurable discovery queries using queries.json with variable substitution
 */
export function generateSearchQueries(): string[] {
  const date = new Date();
  const currentMonth = date.toLocaleString("en-US", { month: "long" });
  const currentYear = date.getFullYear().toString();

  // Try reading queries.json from project root
  const queriesPath = path.resolve(process.cwd(), "queries.json");
  if (fs.existsSync(queriesPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(queriesPath, "utf-8"));
      const negativeFilter: string = config.negativeFilter || "";
      const baseQueries: string[] = config.queries || [];
      const temporalQueries: string[] = config.temporalQueries || [];

      const generated = new Set<string>();

      for (const q of baseQueries) {
        const fullQ = negativeFilter ? `${q} ${negativeFilter}` : q;
        generated.add(fullQ);
      }

      for (const tmpl of temporalQueries) {
        const q = tmpl
          .replace(/{month}/gi, currentMonth)
          .replace(/{year}/gi, currentYear);
        const fullQ = negativeFilter ? `${q} ${negativeFilter}` : q;
        generated.add(fullQ);
      }

      if (generated.size > 0) {
        return Array.from(generated);
      }
    } catch (err) {
      console.warn("Failed to parse queries.json, falling back to defaults:", err);
    }
  }

  // Fallback queries if queries.json is missing
  return [
    "leave a review on G2 get gift card",
    "review us on G2 Amazon gift card",
    "Capterra review gift card",
    "TrustRadius review reward",
    "Gartner Peer Insights review gift card",
    "write a review get $25",
    `leave a review on G2 gift card ${currentMonth} ${currentYear}`,
    `Capterra review gift card ${currentMonth} ${currentYear}`,
    `site:community.* "G2" "review" "gift card"`,
  ];
}
