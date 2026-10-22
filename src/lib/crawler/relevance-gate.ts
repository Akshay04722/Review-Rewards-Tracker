import * as cheerio from "cheerio";
import { PlatformType } from "../types";
import { isValidCandidateUrl } from "./domain-filter";

export interface RelevanceGateResult {
  passed: boolean;
  rejectionReason?: string;
  platform?: PlatformType;
  platformEvidence?: string;
  rewardEvidence?: string;
  actionEvidence?: string;
  outboundReviewLink?: string;
}

const REVIEW_PLATFORMS: { name: PlatformType; pattern: RegExp; linkPattern: RegExp }[] = [
  {
    name: "G2",
    pattern: /\b(?:g2(?:\.com)?|g2\s+crowd)\b/i,
    linkPattern: /^(?:https?:)?\/\/(?:[a-zA-Z0-9-]+\.)*g2\.com(?!\/docs|\/documentation|\/learn|\/research)(?:\/.*)?$/i,
  },
  {
    name: "Capterra",
    pattern: /\bcapterra(?:\.com)?\b/i,
    linkPattern: /^(?:https?:)?\/\/(?:[a-zA-Z0-9-]+\.)*capterra\.com(?:\/.*)?$/i,
  },
  {
    name: "TrustRadius",
    pattern: /\btrustradius(?:\.com)?\b/i,
    linkPattern: /^(?:https?:)?\/\/(?:[a-zA-Z0-9-]+\.)*trustradius\.com(?:\/.*)?$/i,
  },
  {
    name: "GartnerPeerInsights",
    pattern: /gartner\s*(?:peer\s*insights)?|gtnr\.io/i,
    linkPattern: /^(?:https?:)?\/\/(?:[a-zA-Z0-9-]+\.)*(?:gartner\.com\/reviews|gtnr\.io)(?:\/.*)?$/i,
  },
  {
    name: "SoftwareAdvice",
    pattern: /software\s*advice(?:\.com)?/i,
    linkPattern: /^(?:https?:)?\/\/(?:[a-zA-Z0-9-]+\.)*softwareadvice\.com(?:\/.*)?$/i,
  },
  {
    name: "GetApp",
    pattern: /\bgetapp(?:\.com)?\b/i,
    linkPattern: /^(?:https?:)?\/\/(?:[a-zA-Z0-9-]+\.)*getapp\.com(?:\/.*)?$/i,
  },
  {
    name: "Trustpilot",
    pattern: /\btrustpilot(?:\.com)?\b/i,
    linkPattern: /^(?:https?:)?\/\/(?:[a-zA-Z0-9-]+\.)*trustpilot\.com(?:\/.*)?$/i,
  },
];

const TRACKED_CAMPAIGN_URL_PATTERNS = [
  /^(?:https?:)?\/\/(?:[a-zA-Z0-9-]+\.)*(?:typeform\.com|surveymonkey\.com|qualtrics\.com|forms\.gle|google\.com\/forms)(?:\/.*)?$/i,
  /^(?:https?:)?\/\/(?:[a-zA-Z0-9-]+\.)*(?:sendoso\.com|tremendous\.com|rybbon\.net)(?:\/.*)?$/i,
];

const REVIEW_ACTION_PATTERNS = [
  /\bwrite\s+(?:a\s+|an\s+)?review\b/i,
  /\bleave\s+(?:a\s+|an\s+)?review\b/i,
  /\brate\s+us\b/i,
  /\bshare\s+your\s+(?:review|feedback)\b/i,
  /\bsubmit\s+(?:a\s+)?review\b/i,
  /\bpost\s+(?:a\s+)?review\b/i,
  /\breview\s+(?:us|our\s+software|our\s+product|our\s+app)\b/i,
  /\bpublish\s+(?:a\s+)?review\b/i,
  /\breview\b/i,
];

const REWARD_PATTERNS = [
  /\$\s*([1-9]\d*(?:\.\d{2})?)/,
  /([1-9]\d*)\s*(?:USD|usd)\b/,
  /£\s*([1-9]\d*)/,
  /€\s*([1-9]\d*)/,
  /\bgift\s*cards?\b/i,
  /\bamazon\s*(?:gift\s*)?cards?\b/i,
  /\bvisa(?:\s+(?:gift|prepaid))?\s*cards?\b/i,
  /\bvouchers?\b/i,
  /\brewards?\b/i,
  /\bthank-?you\s+gifts?\b/i,
];

function extractSnippet(text: string, matchIndex: number, maxWords = 15): string {
  const start = Math.max(0, matchIndex - 50);
  const end = Math.min(text.length, matchIndex + 100);
  const raw = text.slice(start, end).replace(/\s+/g, " ").trim();
  const words = raw.split(" ");
  if (words.length <= maxWords) return raw;
  return words.slice(0, maxWords).join(" ");
}

/**
 * Executes the strict Relevance Gate:
 * All four conditions (a, b, c, d) must be true, and none of the rejection patterns may match.
 */
export function checkRelevanceGate(
  html: string,
  url: string
): RelevanceGateResult {
  // Check candidate URL domain filter first
  if (!isValidCandidateUrl(url)) {
    return { passed: false, rejectionReason: "Blocked domain, URL keyword, or file type" };
  }

  const $ = cheerio.load(html);

  // Remove script and style tags to read clean visible body text
  $("script, style, noscript, svg").remove();
  const title = $("title").text().toLowerCase();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  // 1. REJECT: Blog posts about "how to get more reviews" / asking for reviews
  const blogHowToPattern =
    /\b(?:how\s+to\s+(?:get|ask\s+for|increase|collect|generate|request|encourage)\s+(?:more\s+)?reviews|strategies\s+to\s+get\s+reviews|tips\s+(?:to|for)\s+getting\s+reviews|guide\s+to\s+(?:getting\s+)?reviews)\b/i;
  if (blogHowToPattern.test(title) || blogHowToPattern.test(bodyText.slice(0, 1500))) {
    return {
      passed: false,
      rejectionReason: "Educational/blog article on how to get more customer reviews",
    };
  }

  // 1.5 REJECT: Pure FAQ / Help Center / Support pages (e.g. /support/faq)
  try {
    const parsed = new URL(url);
    const h1Text = $("h1").text().toLowerCase();
    if (
      parsed.pathname.includes("/faq") ||
      parsed.pathname.includes("/faqs") ||
      title.includes("frequently asked questions") ||
      h1Text.includes("frequently asked questions")
    ) {
      return { passed: false, rejectionReason: "FAQ or Help Center page" };
    }
  } catch {}

  // 1.6 REJECT: Pricing and subscription plan pages
  try {
    const parsed = new URL(url);
    if (parsed.pathname.includes("/pricing") || /\bpricing\b|\bplans\b/i.test(title)) {
      return { passed: false, rejectionReason: "Pricing or subscription plans page" };
    }
  } catch {}

  // 2. REJECT: Listicles
  const listiclePattern =
    /\b(?:top\s+\d+|best\s+\d+|\d+\s+best)\s+(?:review\s+management|review\s+sites|software|tools|alternatives)\b/i;
  if (listiclePattern.test(title)) {
    return { passed: false, rejectionReason: "Listicle or product comparison page" };
  }

  // 3. REJECT: G2A / Gaming key sites / Deals / Coupon shopping pages
  const g2aPattern = /\bg2a(?:\.com)?\b|\bsteam\s+key\b|\bcd\s*keys?\b|\bgame\s+keys?\b/i;
  if (g2aPattern.test(url) || g2aPattern.test(title) || g2aPattern.test(bodyText.slice(0, 800))) {
    return { passed: false, rejectionReason: "G2A / gaming key / coupon deal page" };
  }

  // Condition a: Review-platform mention
  let matchedPlatform: PlatformType | undefined;
  let platformEvidence: string | undefined;

  for (const plat of REVIEW_PLATFORMS) {
    const match = bodyText.match(plat.pattern);
    if (match && match.index !== undefined) {
      matchedPlatform = plat.name;
      platformEvidence = extractSnippet(bodyText, match.index);
      break;
    }
  }

  if (!matchedPlatform) {
    return {
      passed: false,
      rejectionReason: "Condition a failed: No supported review platform mention (G2, Capterra, etc.)",
    };
  }

  // Condition b: Review action
  let matchedAction: string | undefined;
  let actionEvidence: string | undefined;

  for (const act of REVIEW_ACTION_PATTERNS) {
    const match = bodyText.match(act);
    if (match && match.index !== undefined) {
      matchedAction = match[0];
      actionEvidence = extractSnippet(bodyText, match.index);
      break;
    }
  }

  if (!matchedAction) {
    return {
      passed: false,
      rejectionReason: 'Condition b failed: No review action found ("review", "write a review", etc.)',
    };
  }

  // Condition c: Reward mention (money amount or reward terms)
  let matchedReward: string | undefined;
  let rewardEvidence: string | undefined;

  for (const rew of REWARD_PATTERNS) {
    const match = bodyText.match(rew);
    if (match && match.index !== undefined) {
      matchedReward = match[0];
      rewardEvidence = extractSnippet(bodyText, match.index);
      break;
    }
  }

  if (!matchedReward) {
    return {
      passed: false,
      rejectionReason: "Condition c failed: No reward mention or dollar/currency amount found",
    };
  }

  // Condition d: Outbound or button link whose href points to a review platform, OR a tracked platform campaign URL
  let outboundReviewLink: string | undefined;

  $("a[href], button[data-href], [data-url]").each((_, el) => {
    const href = $(el).attr("href") || $(el).attr("data-href") || $(el).attr("data-url");
    if (!href) return;

    let absoluteHref: string;
    try {
      absoluteHref = new URL(href, url).toString();
    } catch {
      return;
    }

    // 1. Direct review platform link
    for (const plat of REVIEW_PLATFORMS) {
      if (plat.linkPattern.test(absoluteHref)) {
        try {
          const parsedLink = new URL(absoluteHref);
          const linkPath = parsedLink.pathname.replace(/\/+$/, "");
          if (linkPath === "" || linkPath === "/") {
            continue;
          }
        } catch {
          continue;
        }

        outboundReviewLink = absoluteHref;
        if (!matchedPlatform || matchedPlatform === "Other") {
          matchedPlatform = plat.name;
        }
        return false; // Break loop
      }
    }

    // 2. Tracked platform campaign URL (Typeform claim form, SurveyMonkey, etc.)
    for (const trackedPattern of TRACKED_CAMPAIGN_URL_PATTERNS) {
      if (trackedPattern.test(absoluteHref)) {
        outboundReviewLink = absoluteHref;
        return false;
      }
    }
  });

  if (!outboundReviewLink) {
    return {
      passed: false,
      rejectionReason:
        "Condition d failed: No outbound link pointing to a review platform or tracked platform campaign URL",
    };
  }

  return {
    passed: true,
    platform: matchedPlatform,
    platformEvidence,
    rewardEvidence,
    actionEvidence,
    outboundReviewLink,
  };
}
