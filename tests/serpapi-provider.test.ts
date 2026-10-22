import { describe, it, expect, beforeEach } from "vitest";
import { SerpApiProvider, generateSearchQueries } from "../src/lib/crawler/search-providers";
import prisma from "../src/lib/prisma";
import crypto from "crypto";

describe("SerpAPI Provider & Query Generator", () => {
  it("should generate queries from queries.json with platform and temporal substitutions", () => {
    const queries = generateSearchQueries();
    expect(queries.length).toBeGreaterThan(10);

    // Check that placeholders {platform}, {month}, {year} were replaced
    const hasUnreplaced = queries.some(
      (q) => q.includes("{platform}") || q.includes("{month}") || q.includes("{year}")
    );
    expect(hasUnreplaced).toBe(false);

    // Verify presence of G2, Capterra, and negative domain exclusions
    const hasG2 = queries.some((q) => q.includes("G2"));
    const hasCapterra = queries.some((q) => q.includes("Capterra"));
    const hasSiteExclusion = queries.some((q) => q.includes("-site:g2.com"));

    expect(hasG2).toBe(true);
    expect(hasCapterra).toBe(true);
    expect(hasSiteExclusion).toBe(true);
  });

  it("should return cached results from database if available within 24 hours", async () => {
    const provider = new SerpApiProvider("test_api_key");
    const testQuery = "test software review incentive gift card";

    const cacheParams = {
      engine: "google",
      query: testQuery,
      num: 10,
      start: 0,
      hl: "en",
      gl: "us",
      tbs: "qdr:m",
    };
    const cacheKey = crypto
      .createHash("sha256")
      .update(JSON.stringify(cacheParams))
      .digest("hex");

    const mockResults = [
      {
        url: "https://example.com/rewards/capterra-25",
        title: "Claim $25 Review Incentive",
        snippet: "Get an Amazon gift card for writing a review.",
        date: "2 days ago",
        displayedLink: "https://example.com › rewards",
      },
    ];

    // Seed test cache entry
    await prisma.searchCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        query: testQuery,
        results: JSON.stringify(mockResults),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      update: {
        results: JSON.stringify(mockResults),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const results = await provider.search(testQuery, { limit: 10, offset: 0 });
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://example.com/rewards/capterra-25");
    expect(results[0].title).toBe("Claim $25 Review Incentive");

    // Clean up
    await prisma.searchCache.deleteMany({ where: { cacheKey } });
  });

  it("should check remaining quota via SerpAPI account endpoint", async () => {
    const provider = new SerpApiProvider();
    const quota = await provider.getRemainingQuota();
    expect(quota).not.toBeNull();
    expect(typeof quota).toBe("number");
    expect(quota).toBeGreaterThan(0);
  });
});
