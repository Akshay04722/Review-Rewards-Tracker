import fs from "fs";
import path from "path";

/**
 * Review platforms themselves should NOT be crawled as candidate vendor pages.
 */
export const REVIEW_PLATFORM_DOMAINS = new Set([
  "g2.com",
  "www.g2.com",
  "landing.g2.com",
  "documentation.g2.com",
  "learn.g2.com",
  "research.g2.com",
  "capterra.com",
  "www.capterra.com",
  "trustradius.com",
  "www.trustradius.com",
  "trustpilot.com",
  "www.trustpilot.com",
  "gartner.com",
  "www.gartner.com",
  "softwareadvice.com",
  "www.softwareadvice.com",
  "getapp.com",
  "www.getapp.com",
]);

interface BlocklistConfig {
  blockedDomains: string[];
  blockedKeywords: string[];
  blockedTitleOrUrlPatterns: string[];
}

function loadBlocklist(): BlocklistConfig {
  try {
    const configPath = path.resolve(process.cwd(), "config", "blocklist.json");
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch (err) {
    console.warn("Could not load config/blocklist.json:", err);
  }
  return {
    blockedDomains: [
      "dealhack.com",
      "slickdeals.net",
      "g2a.com",
      "kinguin.net",
      "famewall.io",
      "documentation.g2.com",
      "reddit.com",
      "quora.com",
      "medium.com",
      "wikipedia.org",
    ],
    blockedKeywords: ["g2a", "coupon code", "promo code", "steam key", "cd key"],
    blockedTitleOrUrlPatterns: [
      "how-to-get-more-reviews",
      "how-to-get-reviews",
      "how-to-ask-for-reviews",
      "best-review-management-software",
    ],
  };
}

const blocklist = loadBlocklist();
const BLOCKED_DOMAINS_SET = new Set(blocklist.blockedDomains.map((d) => d.toLowerCase()));

const BLOCKED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".zip",
  ".tar",
  ".gz",
  ".mp4",
  ".mp3",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
];

/**
 * Checks if a candidate URL is suitable for crawling as a vendor review incentive page.
 * Returns true only if it is a valid, non-blocked vendor web page.
 */
export function isValidCandidateUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();
    const fullUrlLower = rawUrl.toLowerCase();

    // Reject .gov, .mil, .edu
    if (
      hostname.endsWith(".gov") ||
      hostname.endsWith(".mil") ||
      hostname.endsWith(".edu")
    ) {
      return false;
    }

    // Reject review platform domains (and their documentation/marketing pages)
    for (const platformDomain of REVIEW_PLATFORM_DOMAINS) {
      if (hostname === platformDomain || hostname.endsWith("." + platformDomain)) {
        return false;
      }
    }

    // Check blocked domains
    for (const blocked of BLOCKED_DOMAINS_SET) {
      if (hostname === blocked || hostname.endsWith("." + blocked)) {
        return false;
      }
    }

    // Check G2A keyword and other gaming key / coupon keywords in URL
    if (/\bg2a\b/i.test(fullUrlLower) || fullUrlLower.includes("g2a.com")) {
      return false;
    }
    for (const kw of blocklist.blockedKeywords) {
      if (fullUrlLower.includes(kw)) {
        return false;
      }
    }

    // Check blocked URL patterns (e.g. how-to-get-more-reviews, coupon pages, listicles)
    for (const pat of blocklist.blockedTitleOrUrlPatterns) {
      if (pathname.includes(pat)) {
        return false;
      }
    }

    // Reject non-HTML file extensions
    for (const ext of BLOCKED_EXTENSIONS) {
      if (pathname.endsWith(ext) || pathname.includes(ext + "?")) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Checks whether the final URL after redirects is a disallowed page type:
 * homepage (apex/www root), login page, or generic search/tag page.
 */
export function isDisallowedFinalUrl(rawUrl: string): { disallowed: boolean; reason?: string } {
  try {
    const url = new URL(rawUrl);
    const pathname = url.pathname.replace(/\/+$/, "").toLowerCase();
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const parts = hostname.split(".");

    // Apex / www main homepage check (e.g. https://datadoghq.com/ or https://www.datadoghq.com/)
    // Subdomains like community.forwardnetworks.com or help.carbone.io are not generic company homepages
    const isSubdomain = parts.length > 2 && !["www"].includes(parts[0]);
    if (!isSubdomain && (pathname === "" || pathname === "/")) {
      return { disallowed: true, reason: "Final URL is an apex homepage" };
    }

    // Login/account pages
    const loginPattern = /^\/(login|signin|sign-in|auth|signup|sign-up|register|user\/login|account\/login)$/i;
    if (loginPattern.test(pathname)) {
      return { disallowed: true, reason: "Final URL is a login/auth page" };
    }

    // Generic search or tag page
    const searchOrTagPattern = /^\/(search|find|tags?|topics?|categories|category)(\/.*)?$/i;
    if (searchOrTagPattern.test(pathname) || url.searchParams.has("q") || url.searchParams.has("search")) {
      return { disallowed: true, reason: "Final URL is a generic search or tag page" };
    }

    return { disallowed: false };
  } catch {
    return { disallowed: true, reason: "Invalid final URL" };
  }
}
