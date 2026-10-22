import * as cheerio from "cheerio";
import { request } from "undici";
import prisma from "../prisma";
import { domainRateLimiter } from "./rate-limiter";
import { RobotsChecker } from "./robots";
import { detectSoft404 } from "./soft-404";
import { isDisallowedFinalUrl } from "./domain-filter";

export interface FetchResult {
  dropped: boolean;
  dropReason?: string;
  html: string;
  statusCode: number;
  finalUrl: string;
  contentType: string;
  isJsRendered: boolean;
  lastModified?: Date | null;
  blockedByRobots?: boolean;
}

export class PageFetcher {
  private userAgent: string;
  private robotsChecker: RobotsChecker;
  private timeoutMs: number;
  private usePlaywrightFallback: boolean;

  constructor() {
    this.userAgent =
      process.env.CRAWLER_USER_AGENT ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 (compatible; ReviewRewardsBot/1.0)";
    this.robotsChecker = new RobotsChecker(this.userAgent);
    this.timeoutMs = parseInt(process.env.CRAWLER_TIMEOUT_MS || "10000", 10);
    this.usePlaywrightFallback =
      process.env.USE_PLAYWRIGHT_FALLBACK !== "false";
  }

  /**
   * Check if a URL was rejected within the last 7 days.
   */
  async isUrlRecentlyRejected(targetUrl: string): Promise<boolean> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const entry = await prisma.rejectedUrl.findUnique({
        where: { url: targetUrl },
      });
      if (entry && entry.checkedAt >= sevenDaysAgo) {
        return true;
      }
    } catch (err) {
      // If table query fails, don't block crawl
    }
    return false;
  }

  /**
   * Record a dead/dropped URL into the RejectedUrl table so it won't be fetched again for 7 days.
   */
  async recordRejectedUrl(targetUrl: string, reason: string): Promise<void> {
    try {
      await prisma.rejectedUrl.upsert({
        where: { url: targetUrl },
        create: { url: targetUrl, reason, checkedAt: new Date() },
        update: { reason, checkedAt: new Date() },
      });
    } catch (err) {
      // Ignore DB write warning
    }
  }

  /**
   * Fetches public web page reading every page, following redirects (max 5),
   * applying strict drop criteria, and retrying once after 3 seconds on network error.
   */
  async fetchPage(targetUrl: string, forceBrowser = false): Promise<FetchResult> {
    // 0. Check 7-day rejection cache
    const recentlyRejected = await this.isUrlRecentlyRejected(targetUrl);
    if (recentlyRejected) {
      return {
        dropped: true,
        dropReason: "URL rejected within the past 7 days",
        html: "",
        statusCode: 410,
        finalUrl: targetUrl,
        contentType: "",
        isJsRendered: false,
      };
    }

    // 1. Robots.txt compliance check
    const allowed = await this.robotsChecker.isAllowed(targetUrl);
    if (!allowed) {
      await this.recordRejectedUrl(targetUrl, "Blocked by robots.txt");
      return {
        dropped: true,
        dropReason: "Blocked by robots.txt",
        html: "",
        statusCode: 403,
        finalUrl: targetUrl,
        contentType: "text/plain",
        isJsRendered: false,
        blockedByRobots: true,
      };
    }

    // 2. Domain rate limiter
    await domainRateLimiter.throttle(targetUrl);

    // 3. Static fetch via Undici with manual redirect tracking (max 5)
    if (!forceBrowser) {
      const fetchAttempt = async (): Promise<FetchResult> => {
        let currentUrl = targetUrl;
        let redirectCount = 0;
        const maxRedirects = 5;

        while (redirectCount <= maxRedirects) {
          const res = await request(currentUrl, {
            method: "GET",
            headers: {
              "User-Agent": this.userAgent,
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "Cache-Control": "no-cache",
            },
            headersTimeout: this.timeoutMs,
            bodyTimeout: this.timeoutMs,
          });

          // Follow redirect headers manually
          if (
            [301, 302, 303, 307, 308].includes(res.statusCode) &&
            res.headers["location"]
          ) {
            const nextLocation = String(res.headers["location"]);
            try {
              currentUrl = new URL(nextLocation, currentUrl).toString();
            } catch {
              throw new Error(`Invalid redirect location header: ${nextLocation}`);
            }
            redirectCount++;
            if (redirectCount > maxRedirects) {
              throw new Error("Exceeded maximum of 5 redirects");
            }
            continue;
          }

          const rawContentType = String(res.headers["content-type"] || "");
          const contentType = rawContentType.toLowerCase();

          // DROP if content type is not text/html
          if (
            rawContentType &&
            !contentType.includes("text/html") &&
            !contentType.includes("application/xhtml+xml")
          ) {
            const reason = `Non-HTML content type: ${rawContentType}`;
            await this.recordRejectedUrl(targetUrl, reason);
            return {
              dropped: true,
              dropReason: reason,
              html: "",
              statusCode: res.statusCode,
              finalUrl: currentUrl,
              contentType: rawContentType,
              isJsRendered: false,
            };
          }

          // DROP if status is 404, 410, or 5xx
          if (
            res.statusCode === 404 ||
            res.statusCode === 410 ||
            res.statusCode >= 500
          ) {
            const reason = `HTTP status ${res.statusCode}`;
            await this.recordRejectedUrl(targetUrl, reason);
            return {
              dropped: true,
              dropReason: reason,
              html: "",
              statusCode: res.statusCode,
              finalUrl: currentUrl,
              contentType: rawContentType,
              isJsRendered: false,
            };
          }

          // DROP if final URL is a homepage, login, or search/tag page
          const finalUrlCheck = isDisallowedFinalUrl(currentUrl);
          if (finalUrlCheck.disallowed) {
            const reason = finalUrlCheck.reason || "Disallowed final URL";
            await this.recordRejectedUrl(targetUrl, reason);
            return {
              dropped: true,
              dropReason: reason,
              html: "",
              statusCode: res.statusCode,
              finalUrl: currentUrl,
              contentType: rawContentType,
              isJsRendered: false,
            };
          }

          const html = await res.body.text();

          // Extract Last-Modified header if present
          let lastModified: Date | null = null;
          if (res.headers["last-modified"]) {
            const lmParsed = Date.parse(String(res.headers["last-modified"]));
            if (!isNaN(lmParsed)) {
              lastModified = new Date(lmParsed);
            }
          }

          // Check if page needs JavaScript rendering (under 500 chars text body or SPA shell)
          const needsJs = this.detectNeedsJsRendering(html);
          if (needsJs && this.usePlaywrightFallback) {
            return await this.fetchWithPlaywright(currentUrl, targetUrl);
          }

          // DROP if soft 404
          const soft404 = detectSoft404(html);
          if (soft404.isSoft404) {
            const reason = soft404.reason || "Soft 404 error page";
            await this.recordRejectedUrl(targetUrl, reason);
            return {
              dropped: true,
              dropReason: reason,
              html,
              statusCode: res.statusCode,
              finalUrl: currentUrl,
              contentType: rawContentType,
              isJsRendered: false,
              lastModified,
            };
          }

          return {
            dropped: false,
            html,
            statusCode: res.statusCode,
            finalUrl: currentUrl,
            contentType: rawContentType,
            isJsRendered: false,
            lastModified,
          };
        }

        throw new Error("Redirect loop encountered");
      };

      try {
        return await fetchAttempt();
      } catch (err: any) {
        // Retry network errors once after 3 seconds before dropping
        console.warn(`Network error fetching ${targetUrl}: ${err.message}. Retrying in 3s...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        try {
          return await fetchAttempt();
        } catch (retryErr: any) {
          const reason = `Network error/timeout: ${retryErr.message || retryErr}`;
          await this.recordRejectedUrl(targetUrl, reason);
          return {
            dropped: true,
            dropReason: reason,
            html: "",
            statusCode: 599,
            finalUrl: targetUrl,
            contentType: "",
            isJsRendered: false,
          };
        }
      }
    } else {
      return await this.fetchWithPlaywright(targetUrl, targetUrl);
    }
  }

  /**
   * Checks if static HTML is merely an empty SPA shell (under 500 chars body text)
   */
  private detectNeedsJsRendering(html: string): boolean {
    if (!html || html.length < 500) return true;
    const $ = cheerio.load(html);
    const bodyText = $("body").text().trim();
    if (
      bodyText.length < 500 ||
      bodyText.toLowerCase().includes("you need to enable javascript") ||
      bodyText.toLowerCase().includes("enable javascript to run this app")
    ) {
      return true;
    }
    return false;
  }

  /**
   * Browser fetch using Playwright if body text is under 500 chars or JS-rendered
   */
  private async fetchWithPlaywright(currentUrl: string, originalUrl: string): Promise<FetchResult> {
    try {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const context = await browser.newContext({
        userAgent: this.userAgent,
        viewport: { width: 1280, height: 800 },
      });

      const page = await context.newPage();
      const response = await page.goto(currentUrl, {
        waitUntil: "domcontentloaded",
        timeout: this.timeoutMs,
      });

      await page.waitForTimeout(1500);

      const content = await page.content();
      const status = response ? response.status() : 200;
      const finalUrl = page.url();

      await browser.close();

      // Check drop conditions on browser-rendered page
      if (status === 404 || status === 410 || status >= 500) {
        const reason = `HTTP status ${status} via browser`;
        await this.recordRejectedUrl(originalUrl, reason);
        return {
          dropped: true,
          dropReason: reason,
          html: content,
          statusCode: status,
          finalUrl,
          contentType: "text/html",
          isJsRendered: true,
        };
      }

      const finalUrlCheck = isDisallowedFinalUrl(finalUrl);
      if (finalUrlCheck.disallowed) {
        const reason = finalUrlCheck.reason || "Disallowed final URL";
        await this.recordRejectedUrl(originalUrl, reason);
        return {
          dropped: true,
          dropReason: reason,
          html: content,
          statusCode: status,
          finalUrl,
          contentType: "text/html",
          isJsRendered: true,
        };
      }

      const soft404 = detectSoft404(content);
      if (soft404.isSoft404) {
        const reason = soft404.reason || "Soft 404 in rendered page";
        await this.recordRejectedUrl(originalUrl, reason);
        return {
          dropped: true,
          dropReason: reason,
          html: content,
          statusCode: status,
          finalUrl,
          contentType: "text/html",
          isJsRendered: true,
        };
      }

      return {
        dropped: false,
        html: content,
        statusCode: status,
        finalUrl,
        contentType: "text/html",
        isJsRendered: true,
      };
    } catch (browserErr: any) {
      console.warn(`Playwright fallback failed for ${currentUrl}:`, browserErr?.message || browserErr);
      const reason = `Browser rendering failed: ${browserErr.message || browserErr}`;
      return {
        dropped: true,
        dropReason: reason,
        html: "",
        statusCode: 500,
        finalUrl: currentUrl,
        contentType: "text/html",
        isJsRendered: false,
      };
    }
  }
}

export const pageFetcher = new PageFetcher();
