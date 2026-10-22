const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "ref",
  "source",
  "mc_cid",
  "mc_eid",
  "yclid",
  "_hsenc",
  "_hsmi",
  "vero_id",
  "twclid",
  "igshid",
]);

/**
 * Normalizes a URL to a canonical format:
 * - Lowercases protocol and host
 * - Strips standard ports (80/443)
 * - Removes UTM and tracking query parameters
 * - Sorts remaining query parameters
 * - Strips hash/fragment
 * - Removes trailing slash if path != '/'
 */
export function normalizeCanonicalUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());

    // Normalize protocol and host
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();

    // Standard ports removal
    if (
      (url.protocol === "http:" && url.port === "80") ||
      (url.protocol === "https:" && url.port === "443")
    ) {
      url.port = "";
    }

    // Strip hash
    url.hash = "";

    // Clean tracking query parameters
    const params = new URLSearchParams(url.search);
    const keysToDelete: string[] = [];

    params.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (
        TRACKING_PARAMS.has(lower) ||
        lower.startsWith("utm_") ||
        lower.startsWith("pk_")
      ) {
        keysToDelete.push(key);
      }
    });

    for (const key of keysToDelete) {
      params.delete(key);
    }

    // Sort remaining keys for deterministic URL
    params.sort();
    url.search = params.toString() ? `?${params.toString()}` : "";

    // Normalize trailing slash
    let pathname = url.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    url.pathname = pathname;

    return url.toString();
  } catch {
    // If not a parseable URL, return trimmed as fallback
    return rawUrl.trim();
  }
}
