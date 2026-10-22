import * as cheerio from "cheerio";
import { CampaignStatus, VerificationResult } from "../types";

export const EXPIRED_PHRASES = [
  "program has ended",
  "campaign has ended",
  "campaign is over",
  "campaign closed",
  "limit reached",
  "reward limit reached",
  "reward limit is reached",
  "all gift cards claimed",
  "all rewards claimed",
  "no longer accepting reviews",
  "no longer accepting responses",
  "this survey is now closed",
  "survey has ended",
  "promotion expired",
  "promotion has concluded",
  "out of rewards",
  "quota reached",
  "offer ended",
  "offer has ended",
  "no longer active",
  "no longer available",
];

export interface PageMetadataForStatus {
  statusCode: number;
  html?: string;
  deadlineDate?: Date | null;
  lastUpdatedDate?: Date | null;
  consecutiveFails?: number;
  directLinkValid?: boolean;
  directLinkFailReason?: string;
}

/**
 * Parses visible date signals such as "Updated on", "Last updated", or article metadata.
 */
export function extractPageUpdatedDate(html: string, lastModifiedHeader?: Date | null): Date | null {
  if (lastModifiedHeader instanceof Date && !isNaN(lastModifiedHeader.getTime())) {
    return lastModifiedHeader;
  }

  if (!html) return null;

  try {
    const $ = cheerio.load(html);

    // 1. Meta tag dates
    const metaDate =
      $('meta[property="article:modified_time"]').attr("content") ||
      $('meta[name="last-modified"]').attr("content") ||
      $('meta[property="og:updated_time"]').attr("content") ||
      $('meta[name="date"]').attr("content");

    if (metaDate) {
      const parsed = Date.parse(metaDate);
      if (!isNaN(parsed)) return new Date(parsed);
    }

    // 2. Visible "Updated on" or "Last updated" text
    const bodyText = $("body").text();
    const updateMatch = bodyText.match(
      /(?:updated\s+on|last\s+updated|modified\s+on|date\s+updated|published\s+on)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i
    );

    if (updateMatch) {
      const cleanDate = updateMatch[1].replace(/,/g, " ").trim();
      const parsed = Date.parse(cleanDate);
      if (!isNaN(parsed)) return new Date(parsed);
    }
  } catch {
    // Ignore date parse errors
  }

  return null;
}

/**
 * Strict evaluation of campaign status:
 * EXPIRED, ACTIVE, or LIKELY_ACTIVE
 */
export function evaluateCampaignStatus(
  input: PageMetadataForStatus
): VerificationResult {
  const {
    statusCode,
    html = "",
    deadlineDate,
    lastUpdatedDate,
    consecutiveFails = 0,
    directLinkValid = true,
    directLinkFailReason,
  } = input;

  const now = new Date();

  // 1. HTTP 404 or 410 -> EXPIRED
  if (statusCode === 404 || statusCode === 410) {
    return {
      status: "EXPIRED",
      confidence: 0.99,
      reason: `HTTP ${statusCode} Not Found / Gone`,
      httpStatus: statusCode,
      isDirectLinkValid: false,
    };
  }

  // 2. Failed checks twice in a row -> EXPIRED
  if (consecutiveFails >= 2) {
    return {
      status: "EXPIRED",
      confidence: 0.95,
      reason: `Failed verification checks ${consecutiveFails} times consecutively`,
      httpStatus: statusCode,
      isDirectLinkValid: directLinkValid,
    };
  }

  // 3. Past deadline date -> EXPIRED
  if (deadlineDate && deadlineDate.getTime() < now.getTime()) {
    const dateStr = deadlineDate.toISOString().split("T")[0];
    return {
      status: "EXPIRED",
      confidence: 0.98,
      reason: `Campaign deadline passed on ${dateStr}`,
      httpStatus: statusCode,
      isDirectLinkValid: directLinkValid,
    };
  }

  // 4. Outbound direct campaign link is broken or closed -> EXPIRED
  if (!directLinkValid) {
    return {
      status: "EXPIRED",
      confidence: 0.95,
      reason:
        directLinkFailReason ||
        "Direct review campaign URL is broken, closed, or returned an error",
      httpStatus: statusCode,
      isDirectLinkValid: false,
    };
  }

  // 5. Explicit ending phrases in HTML body -> EXPIRED
  if (html) {
    const $ = cheerio.load(html);
    $("script, style, noscript").remove();
    const bodyText = $("body").text().toLowerCase();

    for (const phrase of EXPIRED_PHRASES) {
      if (bodyText.includes(phrase)) {
        return {
          status: "EXPIRED",
          confidence: 0.95,
          reason: `Page contains campaign ending phrase: "${phrase}"`,
          httpStatus: statusCode,
          isDirectLinkValid: directLinkValid,
        };
      }
    }

    // Additional checks for standalone words like "ended", "closed", "expired" in banner/heading
    const headerBannerText = $("h1, h2, h3, .alert, .banner, .notice, header").text().toLowerCase();
    const endingTokens = [
      /\bended\b/,
      /\bclosed\b/,
      /\bexpired\b/,
      /\bcampaign\s+is\s+over\b/,
      /\bno\s+longer\s+available\b/,
    ];
    for (const token of endingTokens) {
      if (token.test(headerBannerText)) {
        return {
          status: "EXPIRED",
          confidence: 0.95,
          reason: `Campaign header/banner indicates status is closed or ended`,
          httpStatus: statusCode,
          isDirectLinkValid: directLinkValid,
        };
      }
    }
  }

  // 6. Check for future deadline OR update within 45 days -> ACTIVE
  const fortyFiveDaysMs = 45 * 24 * 60 * 60 * 1000;
  const isUpdatedWithin45Days =
    lastUpdatedDate && now.getTime() - lastUpdatedDate.getTime() <= fortyFiveDaysMs;

  if (deadlineDate && deadlineDate.getTime() > now.getTime()) {
    const dateStr = deadlineDate.toISOString().split("T")[0];
    return {
      status: "ACTIVE",
      confidence: 0.95,
      reason: `Future campaign deadline active until ${dateStr}`,
      httpStatus: statusCode,
      isDirectLinkValid: true,
    };
  }

  if (isUpdatedWithin45Days) {
    return {
      status: "ACTIVE",
      confidence: 0.9,
      reason: "Campaign page confirmed active and updated within the last 45 days",
      httpStatus: statusCode,
      isDirectLinkValid: true,
    };
  }

  // 7. Page works and has no ending phrases, but no date signal -> LIKELY_ACTIVE
  return {
    status: "LIKELY_ACTIVE",
    confidence: 0.75,
    reason: "Campaign page active with working review link, but no explicit recent date or deadline specified",
    httpStatus: statusCode,
    isDirectLinkValid: true,
  };
}
