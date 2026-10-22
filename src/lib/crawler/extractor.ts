import * as cheerio from "cheerio";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import {
  ExtractedCampaign,
  ExtractedCampaignSchema,
  PlatformList,
  PlatformType,
  RewardType,
} from "../types";
import { normalizeCanonicalUrl } from "./canonical";
import { checkRelevanceGate, RelevanceGateResult } from "./relevance-gate";
import { verifyDirectReviewLink } from "./link-verifier";
import { evaluateCampaignStatus, extractPageUpdatedDate } from "./status-detector";
import { computeQualityScore } from "./quality-score";

const LLMFillSchema = z.object({
  vendorName: z.string().nullable().optional(),
  productName: z.string().nullable().optional(),
  rewardAmount: z.number().nullable().optional(),
  rewardCurrency: z.string().nullable().optional(),
  rewardType: z.enum(["Amazon", "Visa", "UberEats", "Cash", "Donation", "Other"]).nullable().optional(),
  rewardLimit: z.string().nullable().optional(),
  eligibility: z.string().nullable().optional(),
  deadlineDateStr: z.string().nullable().optional(),
});

function extractSnippet(text: string, matchIndex: number, maxWords = 15): string {
  const start = Math.max(0, matchIndex - 50);
  const end = Math.min(text.length, matchIndex + 100);
  const raw = text.slice(start, end).replace(/\s+/g, " ").trim();
  const words = raw.split(" ");
  if (words.length <= maxWords) return raw;
  return words.slice(0, maxWords).join(" ");
}

/**
 * Parses deadline date from text using regex heuristics.
 */
export function parseDeadlineDate(text: string): { date: Date | null; snippet: string | null } {
  const patterns = [
    /(?:valid\s+until|offer\s+ends|deadline|expires|before|by|until)[:\s]+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/i,
    /(?:valid\s+until|offer\s+ends|deadline|expires|before|by|until)[:\s]+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4})/i,
    /(?:valid\s+until|offer\s+ends|deadline|expires|before|by|until)[:\s]+(\d{4}-\d{2}-\d{2})/i,
    /(?:ended|ends|deadline)[:\s]+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+(?:\s+\d{4})?)/i,
    /(?:ended|ends|deadline)[:\s]+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+\d{4})?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      let rawDateStr = match[1]
        .replace(/(st|nd|rd|th)/gi, "")
        .replace(/,/g, " ")
        .trim();

      // If year is missing in string like "30 September", append current year or 2026
      if (!/\d{4}/.test(rawDateStr)) {
        rawDateStr += ` ${new Date().getFullYear()}`;
      }

      const timestamp = Date.parse(rawDateStr);
      if (!isNaN(timestamp)) {
        return {
          date: new Date(timestamp),
          snippet: extractSnippet(text, match.index, 15),
        };
      }
    }
  }

  return { date: null, snippet: null };
}

/**
 * Extracts campaign using strict rules and DOM selectors.
 */
export function extractCampaignWithRules(
  html: string,
  url: string,
  relevance: RelevanceGateResult,
  lastModifiedHeader?: Date | null
): ExtractedCampaign | null {
  try {
    const canonical = normalizeCanonicalUrl(url);
    const parsedUrl = new URL(url);
    const $ = cheerio.load(html);

    // Strip script and style
    $("script, style, noscript, svg").remove();
    const fullText = $("body").text().replace(/\s+/g, " ");

    const pageTitle =
      $('meta[property="og:title"]').attr("content") ||
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      "Software Review Incentive";

    // 1. Vendor Name
    let vendorName: string =
      $('meta[property="og:site_name"]').attr("content") ||
      $('meta[name="application-name"]').attr("content") ||
      "";

    if (!vendorName) {
      try {
        const parts = parsedUrl.hostname.replace(/^www\./, "").split(".");
        if (parts[0] && parts[0] !== "community" && parts[0] !== "help" && parts[0] !== "docs") {
          vendorName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        } else if (parts[1]) {
          vendorName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
        }
      } catch {
        vendorName = "Software Vendor";
      }
    }

    // 2. Product Name
    let productName = vendorName;
    const h1 = $("h1").first().text().trim();
    if (h1 && !h1.toLowerCase().includes("gift card") && h1.length < 60) {
      const cleanH1 = h1.replace(/review|incentive|program|rewards?|guidelines/gi, "").trim();
      if (cleanH1.length > 2) productName = cleanH1;
    }

    // 3. Platform & Direct Campaign URL (from relevance gate)
    const platform = relevance.platform || "Other";
    const directCampaignUrl = relevance.outboundReviewLink || "";

    // 4. Reward Amount & Currency
    let rewardAmount = 0;
    let rewardCurrency = "USD";
    let rewardSnippet = relevance.rewardEvidence || null;

    const rewardPatterns = [
      /\$(\d+(?:\.\d{2})?)\s*(?:Amazon|Visa|UberEats|e-gift|gift\s*card|prepaid|voucher|reward)/i,
      /(?:gift\s*card|voucher|reward|incentive)(?:\s+(?:worth|of|value of|valued at))?[:\s]+\$(\d+(?:\.\d{2})?)/i,
      /(?:get|receive|earn|claim)\s+(?:a\s+)?\$(\d+(?:\.\d{2})?)/i,
      /\$(\d+(?:\.\d{2})?)/,
      /(\d+)\s*USD/i,
      /€(\d+(?:\.\d{2})?)/,
      /£(\d+(?:\.\d{2})?)/,
    ];

    for (const pat of rewardPatterns) {
      const match = fullText.match(pat);
      if (match && match.index !== undefined) {
        const val = parseFloat(match[1]);
        const surrounding = fullText
          .slice(Math.max(0, match.index - 40), match.index + match[0].length + 40)
          .toLowerCase();
        const isPricing =
          /\/(?:mo|month|year|yr|user|seat|license|hour|hr|day)\b/.test(surrounding) ||
          /\b(?:billed|starting\s+at|save\s+\$|discount|subscription|per\s+month|per\s+user)\b/.test(surrounding);

        if (!isPricing && val >= 5 && val <= 500) {
          rewardAmount = val;
          if (match[0].includes("€")) rewardCurrency = "EUR";
          else if (match[0].includes("£")) rewardCurrency = "GBP";
          else rewardCurrency = "USD";
          rewardSnippet = extractSnippet(fullText, match.index, 15);
          break;
        }
      }
    }

    // 5. Reward Type
    let rewardType: RewardType = "Other";
    if (/amazon/i.test(fullText)) {
      rewardType = "Amazon";
    } else if (/visa/i.test(fullText) || /prepaid/i.test(fullText)) {
      rewardType = "Visa";
    } else if (/uber\s*eats/i.test(fullText)) {
      rewardType = "UberEats";
    } else if (/cash|paypal|direct\s+deposit/i.test(fullText)) {
      rewardType = "Cash";
    } else if (/donation|charity/i.test(fullText)) {
      rewardType = "Donation";
    }

    // Require quantifiable reward or recognized reward type
    if (rewardAmount <= 0 && rewardType === "Other") {
      return null;
    }

    // 6. Reward Limit
    let rewardLimit: string | null = null;
    const limitMatch = fullText.match(
      /(?:first|next)\s+(\d+)\s+(?:reviewers|reviews|customers|participants)/i
    );
    if (limitMatch) {
      rewardLimit = limitMatch[0];
    }

    // 7. Eligibility
    let eligibility: string | null = null;
    const eligTokens: string[] = [];
    if (/current\s+customers?\s+only/i.test(fullText)) eligTokens.push("Current customers only");
    if (/work\s+email|business\s+email|corporate\s+email/i.test(fullText)) eligTokens.push("Work email required");
    if (/verified\s+users?/i.test(fullText)) eligTokens.push("Verified user account");
    if (eligTokens.length > 0) eligibility = eligTokens.join(", ");

    // 8. Deadline Date
    const { date: deadlineDate, snippet: deadlineSnippet } = parseDeadlineDate(fullText);

    // 9. Status & Freshness
    const lastUpdatedDate = extractPageUpdatedDate(html, lastModifiedHeader);

    // Build description in our own words (max 300 characters, never copied verbatim)
    const rewardDesc =
      rewardAmount > 0
        ? `${rewardCurrency} ${rewardAmount} ${rewardType}`
        : `${rewardType} reward`;
    const desc = `${vendorName} provides a ${rewardDesc} incentive for publishing a verified review on ${platform}.${
      rewardLimit ? ` Limited to ${rewardLimit}.` : ""
    }${eligibility ? ` Eligibility: ${eligibility}.` : ""}`.slice(0, 300);

    const evidence = {
      reward: rewardSnippet,
      platform: relevance.platformEvidence || null,
      status: deadlineSnippet || null,
    };

    return {
      vendorName,
      productName,
      pageTitle: pageTitle.slice(0, 200),
      canonicalUrl: canonical,
      platform,
      directCampaignUrl,
      rewardAmount,
      rewardCurrency,
      rewardType,
      description: desc,
      rewardLimit,
      eligibility,
      deadlineDate,
      evidence,
      qualityScore: 0.8,
      statusReason: "",
      linkBroken: false,
      status: "ACTIVE",
      confidence: 0.85,
    };
  } catch (err) {
    console.warn("Rule extraction error:", err);
    return null;
  }
}

/**
 * Optional Anthropic LLM pass to fill in missing fields if rule extraction had gaps
 */
async function fillMissingFieldsWithLLM(
  campaign: ExtractedCampaign,
  html: string
): Promise<ExtractedCampaign> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return campaign;

  // Only call LLM if important fields are missing
  const needsFill =
    !campaign.vendorName ||
    campaign.vendorName === "Software Vendor" ||
    campaign.rewardAmount === 0 ||
    !campaign.deadlineDate;

  if (!needsFill) return campaign;

  try {
    const anthropic = new Anthropic({ apiKey });
    const $ = cheerio.load(html);
    $("script, style, noscript, svg").remove();
    const cleanText = $("body").text().replace(/\s+/g, " ").slice(0, 4000);

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 300,
      temperature: 0,
      system:
        "You are a structured data extractor. Extract vendorName, productName, rewardAmount (number), rewardCurrency, rewardType, rewardLimit, eligibility, deadlineDateStr (YYYY-MM-DD or null). Output ONLY valid JSON matching this schema.",
      messages: [
        {
          role: "user",
          content: `Extract review campaign fields from this text:\n\n${cleanText}`,
        },
      ],
    });

    const contentBlock = response.content[0];
    if (contentBlock && contentBlock.type === "text") {
      const parsed = LLMFillSchema.safeParse(JSON.parse(contentBlock.text));
      if (parsed.success) {
        const d = parsed.data;
        if (!campaign.vendorName || campaign.vendorName === "Software Vendor") {
          if (d.vendorName) campaign.vendorName = d.vendorName;
        }
        if (campaign.rewardAmount === 0 && d.rewardAmount && d.rewardAmount > 0) {
          campaign.rewardAmount = d.rewardAmount;
        }
        if (d.rewardCurrency) campaign.rewardCurrency = d.rewardCurrency;
        if (d.rewardType && campaign.rewardType === "Other") campaign.rewardType = d.rewardType;
        if (!campaign.rewardLimit && d.rewardLimit) campaign.rewardLimit = d.rewardLimit;
        if (!campaign.eligibility && d.eligibility) campaign.eligibility = d.eligibility;
        if (!campaign.deadlineDate && d.deadlineDateStr) {
          const parsedDate = Date.parse(d.deadlineDateStr);
          if (!isNaN(parsedDate)) campaign.deadlineDate = new Date(parsedDate);
        }
      }
    }
  } catch (llmErr) {
    console.warn("LLM fallback extraction error:", llmErr);
  }

  return campaign;
}

/**
 * Main extractor that:
 * 1. Checks Relevance Gate (drops non-campaigns)
 * 2. Extracts structured fields using rules
 * 3. Fills missing fields via LLM if available
 * 4. Verifies directCampaignUrl (HTTP 200 to 399)
 * 5. Evaluates strict status & confidence
 * 6. Computes qualityScore (filters < 0.6)
 */
export async function extractCampaign(
  html: string,
  url: string,
  lastModifiedHeader?: Date | null
): Promise<ExtractedCampaign | null> {
  // 1. Relevance gate
  const relevance = checkRelevanceGate(html, url);
  if (!relevance.passed) {
    return null;
  }

  // 2. Rules-based extraction
  let campaign = extractCampaignWithRules(html, url, relevance, lastModifiedHeader);
  if (!campaign) {
    return null;
  }

  // 3. LLM fill for missing fields
  campaign = await fillMissingFieldsWithLLM(campaign, html);

  // 4. Verify outbound direct review link reachability
  let directLinkValid = true;
  let directLinkFailReason: string | undefined;

  if (campaign.directCampaignUrl) {
    const linkRes = await verifyDirectReviewLink(campaign.directCampaignUrl);
    directLinkValid = linkRes.isValid;
    directLinkFailReason = linkRes.reason;
    campaign.linkBroken = !linkRes.isValid;
  }

  // 5. Evaluate strict status
  const lastUpdatedDate = extractPageUpdatedDate(html, lastModifiedHeader);
  const statusResult = evaluateCampaignStatus({
    statusCode: 200,
    html,
    deadlineDate: campaign.deadlineDate,
    lastUpdatedDate,
    consecutiveFails: 0,
    directLinkValid,
    directLinkFailReason,
  });

  campaign.status = statusResult.status;
  campaign.confidence = statusResult.confidence;
  campaign.statusReason = statusResult.reason;

  // 6. Compute quality score
  const quality = computeQualityScore({
    hasDirectCampaignUrl: !!campaign.directCampaignUrl,
    hasRewardAmount: campaign.rewardAmount > 0,
    hasPlatform: campaign.platform !== "Other",
    hasDateOrDeadline: !!campaign.deadlineDate || !!lastUpdatedDate,
    linkWorks: !campaign.linkBroken,
  });

  campaign.qualityScore = quality.score;

  // Filter out listings with qualityScore below 0.6
  if (!quality.passed) {
    console.warn(`[QualityFilter] Dropping ${url}: score ${quality.score} < 0.6. Missing: ${quality.missingFields.join(", ")}`);
    return null;
  }

  return ExtractedCampaignSchema.parse(campaign);
}

/**
 * Synchronous/heuristic extraction wrapper matching legacy test signature
 */
export function extractCampaignWithHeuristics(
  html: string,
  url: string,
  lastModifiedHeader?: Date | null
): ExtractedCampaign | null {
  const relevance = checkRelevanceGate(html, url);
  if (!relevance.passed) return null;
  return extractCampaignWithRules(html, url, relevance, lastModifiedHeader);
}
