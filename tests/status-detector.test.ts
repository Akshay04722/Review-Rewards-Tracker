import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { evaluateCampaignStatus } from "../src/lib/crawler/status-detector";

describe("Status Detector", () => {
  it("should classify HTTP 404 / 410 as EXPIRED", () => {
    const res404 = evaluateCampaignStatus({ statusCode: 404 });
    expect(res404.status).toBe("EXPIRED");
    expect(res404.confidence).toBeGreaterThanOrEqual(0.95);

    const res410 = evaluateCampaignStatus({ statusCode: 410 });
    expect(res410.status).toBe("EXPIRED");
  });

  it("should classify 2 consecutive failed checks as EXPIRED", () => {
    const result = evaluateCampaignStatus({
      statusCode: 200,
      consecutiveFails: 2,
    });
    expect(result.status).toBe("EXPIRED");
    expect(result.reason).toContain("Failed verification checks 2 times");
  });

  it("should classify past deadline date as EXPIRED", () => {
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const result = evaluateCampaignStatus({
      statusCode: 200,
      deadlineDate: pastDate,
    });
    expect(result.status).toBe("EXPIRED");
    expect(result.reason).toContain("Campaign deadline passed");
  });

  it("should classify expiration phrases in HTML as EXPIRED", () => {
    const fixturePath = path.join(__dirname, "fixtures", "expired_capterra_phrase.html");
    const html = fs.readFileSync(fixturePath, "utf-8");

    const result = evaluateCampaignStatus({
      statusCode: 200,
      html,
      directLinkValid: true,
    });

    expect(result.status).toBe("EXPIRED");
    expect(result.reason.toLowerCase()).toMatch(/all gift cards claimed|no longer active|offer ended/);
  });

  it("should classify future deadline with working direct link as ACTIVE", () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days future
    const result = evaluateCampaignStatus({
      statusCode: 200,
      html: "<html><body><p>We are collecting reviews! Get a $25 reward.</p></body></html>",
      deadlineDate: futureDate,
      directLinkValid: true,
    });

    expect(result.status).toBe("ACTIVE");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("should classify page older than 45 days without deadline or ending phrases as LIKELY_ACTIVE", () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const result = evaluateCampaignStatus({
      statusCode: 200,
      html: "<html><body><p>Leave a review on G2 to receive a gift card.</p></body></html>",
      lastUpdatedDate: sixtyDaysAgo,
      deadlineDate: null,
      directLinkValid: true,
    });

    expect(result.status).toBe("LIKELY_ACTIVE");
    expect(result.confidence).toBe(0.75);
  });
});
