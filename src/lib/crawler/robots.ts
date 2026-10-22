import robotsParser from "robots-parser";

interface RobotsCacheEntry {
  parser: ReturnType<typeof robotsParser> | null;
  timestamp: number;
}

const ROBOTS_CACHE = new Map<string, RobotsCacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class RobotsChecker {
  private userAgent: string;

  constructor(userAgent?: string) {
    this.userAgent =
      userAgent ||
      process.env.CRAWLER_USER_AGENT ||
      "ReviewRewardsBot/1.0 (+https://reviewrewards-tracker.local/bot)";
  }

  /**
   * Checks if crawling the target URL is allowed under robots.txt
   */
  async isAllowed(targetUrl: string): Promise<boolean> {
    try {
      const parsed = new URL(targetUrl);
      const origin = parsed.origin;
      const robotsUrl = `${origin}/robots.txt`;

      const cached = ROBOTS_CACHE.get(origin);
      const now = Date.now();

      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        if (!cached.parser) return true; // Allowed by default if previous fetch failed/404
        return cached.parser.isAllowed(targetUrl, this.userAgent) ?? true;
      }

      // Fetch robots.txt with short timeout and redirect handling
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch(robotsUrl, {
            method: "GET",
            headers: {
              "User-Agent": this.userAgent,
            },
            redirect: "follow",
            signal: controller.signal,
          });

          if (res.status >= 200 && res.status < 300) {
            const body = await res.text();
            const parser = robotsParser(robotsUrl, body);
            ROBOTS_CACHE.set(origin, { parser, timestamp: now });
            return parser.isAllowed(targetUrl, this.userAgent) ?? true;
          } else {
            // If 404 or other non-200, assume allowed
            ROBOTS_CACHE.set(origin, { parser: null, timestamp: now });
            return true;
          }
        } finally {
          clearTimeout(timer);
        }
      } catch {
        // Network error fetching robots.txt -> don't block
        ROBOTS_CACHE.set(origin, { parser: null, timestamp: now });
        return true;
      }
    } catch {
      // Invalid URL or error
      return false;
    }
  }
}
