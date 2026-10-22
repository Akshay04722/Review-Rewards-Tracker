/**
 * Domain Rate Limiter ensuring at most 1 request per domain every 2000ms (configurable)
 */
class DomainRateLimiter {
  private lastRequestTimes = new Map<string, number>();
  private minIntervalMs: number;

  constructor(intervalMs = 2000) {
    this.minIntervalMs = intervalMs;
  }

  /**
   * Waits if necessary before allowing a request to the specified domain
   */
  async throttle(url: string): Promise<void> {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      const now = Date.now();
      const lastTime = this.lastRequestTimes.get(hostname) || 0;
      const elapsed = now - lastTime;

      if (elapsed < this.minIntervalMs) {
        const delay = this.minIntervalMs - elapsed;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      this.lastRequestTimes.set(hostname, Date.now());
    } catch {
      // In case of invalid URL
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

export const domainRateLimiter = new DomainRateLimiter(
  parseInt(process.env.CRAWLER_DOMAIN_DELAY_MS || "2000", 10)
);

/**
 * Execute an async operation with exponential backoff and jitter
 */
export async function withExponentialBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 1000
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      attempt++;
      return await operation(attempt);
    } catch (err: any) {
      if (attempt >= maxRetries) {
        throw err;
      }

      // Check if non-retryable error (e.g. 404, 410, 403)
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        throw err;
      }

      const backoff = initialDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 500);
      const totalDelay = backoff + jitter;

      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }
  }
}
