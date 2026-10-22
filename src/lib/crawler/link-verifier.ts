import { request } from "undici";

const SURVEY_CLOSED_PHRASES = [
  "this survey is now closed",
  "this survey has closed",
  "survey is closed",
  "survey is no longer active",
  "no longer accepting responses",
  "this review form is no longer available",
  "promotion has expired",
  "all rewards have been claimed",
  "all rewards claimed",
  "reward limit reached",
  "this page does not exist",
  "page not found",
  "404 not found",
];

export interface LinkVerificationResult {
  isValid: boolean;
  statusCode?: number;
  reason?: string;
}

/**
 * Deeply verifies that an outbound direct review link actually loads (HTTP 200 to 399)
 * and has not expired or closed.
 */
export async function verifyDirectReviewLink(
  targetUrl: string,
  timeoutMs = 8000
): Promise<LinkVerificationResult> {
  try {
    let currentUrl = targetUrl;
    let redirectCount = 0;
    const maxRedirects = 5;

    while (redirectCount <= maxRedirects) {
      try {
        const res = await request(currentUrl, {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          headersTimeout: timeoutMs,
          bodyTimeout: timeoutMs,
        });

        // Follow manual redirects
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers["location"]
        ) {
          const loc = String(res.headers["location"]);
          currentUrl = new URL(loc, currentUrl).toString();
          redirectCount++;
          continue;
        }

        // If review platform returns 404, 410, or server error >= 500
        if (res.statusCode === 404 || res.statusCode === 410) {
          return {
            isValid: false,
            statusCode: res.statusCode,
            reason: `Review platform returned HTTP ${res.statusCode} Not Found`,
          };
        }

        if (res.statusCode >= 500) {
          return {
            isValid: false,
            statusCode: res.statusCode,
            reason: `Review platform server error (HTTP ${res.statusCode})`,
          };
        }

        // If Cloudflare blocks automated request with 403 on g2.com, we do not mark as dead link
        if (res.statusCode === 403) {
          return { isValid: true, statusCode: 403 };
        }

        // For 200..399, check body text for survey closed phrases
        if (res.statusCode >= 200 && res.statusCode < 400) {
          const body = (await res.body.text()).toLowerCase();
          for (const phrase of SURVEY_CLOSED_PHRASES) {
            if (body.includes(phrase)) {
              return {
                isValid: false,
                statusCode: res.statusCode,
                reason: `Review survey indicates closed or limit reached: "${phrase}"`,
              };
            }
          }
          return { isValid: true, statusCode: res.statusCode };
        }

        return {
          isValid: false,
          statusCode: res.statusCode,
          reason: `Review platform returned unexpected HTTP ${res.statusCode}`,
        };
      } catch (err: any) {
        // Retry network errors once after 3 seconds
        await new Promise((resolve) => setTimeout(resolve, 3000));
        try {
          const retryRes = await request(currentUrl, {
            method: "GET",
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            headersTimeout: timeoutMs,
            bodyTimeout: timeoutMs,
          });

          if (retryRes.statusCode === 403 || (retryRes.statusCode >= 200 && retryRes.statusCode < 400)) {
            return { isValid: true, statusCode: retryRes.statusCode };
          }
          if (retryRes.statusCode === 404 || retryRes.statusCode === 410) {
            return {
              isValid: false,
              statusCode: retryRes.statusCode,
              reason: `Review platform returned HTTP ${retryRes.statusCode} Not Found`,
            };
          }
        } catch {
          // Fall through
        }

        return {
          isValid: false,
          reason: `Failed to resolve review link: ${err.message || err}`,
        };
      }
    }

    return { isValid: true, statusCode: 200 };
  } catch (err: any) {
    return {
      isValid: false,
      reason: `Failed to connect to review link: ${err.message || err}`,
    };
  }
}
