export interface QualityScoreInput {
  hasDirectCampaignUrl: boolean;
  hasRewardAmount: boolean;
  hasPlatform: boolean;
  hasDateOrDeadline: boolean;
  linkWorks: boolean;
}

export interface QualityScoreResult {
  score: number;
  passed: boolean;
  missingFields: string[];
}

/**
 * Computes qualityScore as a weighted sum:
 * - has directCampaignUrl: 0.3
 * - has rewardAmount: 0.25
 * - has platform: 0.2
 * - has date or deadline: 0.15
 * - link works: 0.1
 * Minimum threshold to display: 0.6
 */
export function computeQualityScore(input: QualityScoreInput): QualityScoreResult {
  let score = 0;
  const missingFields: string[] = [];

  if (input.hasDirectCampaignUrl) {
    score += 0.3;
  } else {
    missingFields.push("directCampaignUrl");
  }

  if (input.hasRewardAmount) {
    score += 0.25;
  } else {
    missingFields.push("rewardAmount");
  }

  if (input.hasPlatform) {
    score += 0.2;
  } else {
    missingFields.push("platform");
  }

  if (input.hasDateOrDeadline) {
    score += 0.15;
  } else {
    missingFields.push("dateOrDeadline");
  }

  if (input.linkWorks) {
    score += 0.1;
  } else {
    missingFields.push("workingDirectLink");
  }

  score = Math.round(score * 100) / 100;

  return {
    score,
    passed: score >= 0.6,
    missingFields,
  };
}
