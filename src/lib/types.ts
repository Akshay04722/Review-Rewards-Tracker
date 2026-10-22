import { z } from "zod";

export const PlatformList = [
  "G2",
  "Capterra",
  "TrustRadius",
  "GartnerPeerInsights",
  "SoftwareAdvice",
  "GetApp",
  "Trustpilot",
  "Other",
] as const;

export type PlatformType = (typeof PlatformList)[number];

export const RewardTypeList = [
  "Amazon",
  "Visa",
  "UberEats",
  "Cash",
  "Donation",
  "Other",
] as const;

export type RewardType = (typeof RewardTypeList)[number];

export const CampaignStatusList = [
  "ACTIVE",
  "LIKELY_ACTIVE",
  "EXPIRED",
  "UNKNOWN",
] as const;

export type CampaignStatus = (typeof CampaignStatusList)[number];

// Zod schema for extracted campaign data
export const ExtractedCampaignSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required"),
  productName: z.string().min(1, "Product name is required"),
  pageTitle: z.string().default("Review Reward Campaign"),
  canonicalUrl: z.string().url("Valid canonical URL required"),
  platform: z.enum(PlatformList).default("Other"),
  directCampaignUrl: z.string().url("Valid direct campaign URL required"),
  rewardAmount: z.number().min(0).default(0),
  rewardCurrency: z.string().default("USD"),
  rewardType: z.enum(RewardTypeList).default("Other"),
  description: z
    .string()
    .max(300, "Description must be at most 300 characters")
    .default(""),
  rewardLimit: z.string().nullable().optional(),
  eligibility: z.string().nullable().optional(),
  deadlineDate: z.date().nullable().optional(),
  evidence: z
    .object({
      reward: z.string().nullable().optional(),
      platform: z.string().nullable().optional(),
      status: z.string().nullable().optional(),
    })
    .default({}),
  qualityScore: z.number().min(0).max(1).default(0.8),
  statusReason: z.string().default(""),
  linkBroken: z.boolean().default(false),
  status: z.enum(CampaignStatusList).default("UNKNOWN"),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type ExtractedCampaign = z.infer<typeof ExtractedCampaignSchema>;

export interface SearchOptions {
  limit?: number;
  offset?: number;
  page?: number;
  tbs?: string;
  hl?: string;
  gl?: string;
}

export interface SearchResultItem {
  url: string;
  title: string;
  snippet?: string;
  date?: string;
  displayedLink?: string;
}

export interface SearchProvider {
  name: string;
  search(query: string, opts?: SearchOptions | number): Promise<SearchResultItem[]>;
  getRemainingQuota?(): Promise<number | null>;
}

export interface VerificationResult {
  status: CampaignStatus;
  confidence: number;
  reason: string;
  httpStatus?: number;
  isDirectLinkValid?: boolean;
}
