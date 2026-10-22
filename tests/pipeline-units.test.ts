import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { detectSoft404 } from "../src/lib/crawler/soft-404";
import { checkRelevanceGate } from "../src/lib/crawler/relevance-gate";
import { parseDeadlineDate } from "../src/lib/crawler/extractor";
import { evaluateCampaignStatus } from "../src/lib/crawler/status-detector";

describe("Pipeline Unit Tests", () => {
  describe("Soft-404 Detector", () => {
    it("should detect short HTML pages with 404 or page not found phrases", () => {
      const softHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>404 - Page Not Found</title></head>
          <body>
            <h1>Oops! Page Not Found</h1>
            <p>The campaign page you are looking for doesn't exist or is no longer available.</p>
          </body>
        </html>
      `;
      const result = detectSoft404(softHtml);
      expect(result.isSoft404).toBe(true);
      expect(result.reason).toContain("Soft 404 detected");
    });

    it("should NOT detect long valid pages as soft 404", () => {
      const fixturePath = path.resolve(process.cwd(), "fixtures", "golden-html", "hyperglance_com_review_.html");
      if (fs.existsSync(fixturePath)) {
        const validHtml = fs.readFileSync(fixturePath, "utf-8");
        const result = detectSoft404(validHtml);
        expect(result.isSoft404).toBe(false);
      }
    });

    it("should handle empty or whitespace HTML as soft 404", () => {
      expect(detectSoft404("").isSoft404).toBe(true);
      expect(detectSoft404("   ").isSoft404).toBe(true);
    });
  });

  describe("Relevance Gate", () => {
    it("should accept valid campaign with platform, review action, reward, and outbound link", () => {
      const validHtml = `
        <html>
          <body>
            <h1>Write a review on G2</h1>
            <p>Share your honest experience and write a review on G2 to receive a $25 Amazon gift card.</p>
            <a href="https://www.g2.com/products/test-app/take_survey">Write a Review on G2</a>
          </body>
        </html>
      `;
      const res = checkRelevanceGate(validHtml, "https://testvendor.com/rewards/g2");
      expect(res.passed).toBe(true);
      expect(res.platform).toBe("G2");
      expect(res.outboundReviewLink).toContain("g2.com");
    });

    it("should reject blog posts about how to get more reviews", () => {
      const blogHtml = `
        <html>
          <head><title>How to Get More Reviews on G2 in 2026</title></head>
          <body>
            <h1>10 Strategies to Get More Customer Reviews on G2</h1>
            <p>Learn how to ask customers for a review and whether you should offer a $25 gift card.</p>
            <a href="https://www.g2.com/products/example/reviews">Check G2 Reviews</a>
          </body>
        </html>
      `;
      const res = checkRelevanceGate(blogHtml, "https://marketingblog.com/how-to-get-more-reviews");
      expect(res.passed).toBe(false);
      expect(res.rejectionReason).toBeTruthy();
    });

    it("should reject G2A and coupon/gaming deal pages", () => {
      const dealHtml = `
        <html>
          <head><title>G2A Discount Code $25 Off</title></head>
          <body>
            <h1>Get G2A Steam Key Gift Card Deals</h1>
            <p>Review our discount vouchers on G2.</p>
            <a href="https://www.g2.com">G2</a>
          </body>
        </html>
      `;
      const res = checkRelevanceGate(dealHtml, "https://dealhack.com/coupons/g2a");
      expect(res.passed).toBe(false);
      expect(res.rejectionReason).toBeTruthy();
    });

    it("should reject pages missing outbound review links", () => {
      const noLinkHtml = `
        <html>
          <body>
            <h1>Review our software</h1>
            <p>Leave a review on G2 for a $25 reward. Contact us by email.</p>
          </body>
        </html>
      `;
      const res = checkRelevanceGate(noLinkHtml, "https://vendor.com/rewards");
      expect(res.passed).toBe(false);
      expect(res.rejectionReason).toContain("Condition d failed");
    });
  });

  describe("Deadline Parser", () => {
    it("should parse standard date format like 'deadline Nov 15, 2025'", () => {
      const text = "Write an honest review. Offer deadline Nov 15, 2025. Limited time only.";
      const { date, snippet } = parseDeadlineDate(text);
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2025);
      expect(date?.getMonth()).toBe(10); // November is index 10
      expect(date?.getDate()).toBe(15);
      expect(snippet).toContain("deadline Nov 15, 2025");
    });

    it("should parse 'valid until August 12, 2026'", () => {
      const text = "Valid until August 12, 2026 for verified participants.";
      const { date } = parseDeadlineDate(text);
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2026);
      expect(date?.getMonth()).toBe(7); // August is index 7
      expect(date?.getDate()).toBe(12);
    });

    it("should parse 'ended 30 September'", () => {
      const text = "Thank you for participating! Campaign ended 30 September.";
      const { date } = parseDeadlineDate(text);
      expect(date).not.toBeNull();
      expect(date?.getMonth()).toBe(8); // September is index 8
      expect(date?.getDate()).toBe(30);
    });

    it("should return null for text without deadline dates", () => {
      const text = "Write a review on G2 to get a $25 gift card. Open ongoing program.";
      const { date, snippet } = parseDeadlineDate(text);
      expect(date).toBeNull();
      expect(snippet).toBeNull();
    });
  });

  describe("Strict Status Function", () => {
    it("should evaluate past deadline as EXPIRED", () => {
      const past = new Date("2024-01-01");
      const res = evaluateCampaignStatus({
        statusCode: 200,
        deadlineDate: past,
      });
      expect(res.status).toBe("EXPIRED");
      expect(res.confidence).toBeGreaterThanOrEqual(0.95);
      expect(res.reason).toContain("Campaign deadline passed");
    });

    it("should evaluate campaign ending phrases as EXPIRED", () => {
      const endedHtml = "<html><body><p>This program has ended. All gift cards claimed.</p></body></html>";
      const res = evaluateCampaignStatus({
        statusCode: 200,
        html: endedHtml,
      });
      expect(res.status).toBe("EXPIRED");
      expect(res.reason).toContain("ending phrase");
    });

    it("should evaluate broken direct link as EXPIRED", () => {
      const res = evaluateCampaignStatus({
        statusCode: 200,
        directLinkValid: false,
        directLinkFailReason: "Review survey returned HTTP 404",
      });
      expect(res.status).toBe("EXPIRED");
      expect(res.reason).toContain("HTTP 404");
    });

    it("should evaluate future deadline as ACTIVE", () => {
      const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      const res = evaluateCampaignStatus({
        statusCode: 200,
        deadlineDate: future,
        directLinkValid: true,
      });
      expect(res.status).toBe("ACTIVE");
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
      expect(res.reason).toContain("Future campaign deadline");
    });

    it("should evaluate active page within 45 days as ACTIVE", () => {
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      const res = evaluateCampaignStatus({
        statusCode: 200,
        lastUpdatedDate: twentyDaysAgo,
        directLinkValid: true,
      });
      expect(res.status).toBe("ACTIVE");
      expect(res.reason).toContain("last 45 days");
    });

    it("should evaluate working page without date signal as LIKELY_ACTIVE", () => {
      const res = evaluateCampaignStatus({
        statusCode: 200,
        html: "<html><body><p>Review us on G2 for a gift card.</p></body></html>",
        directLinkValid: true,
      });
      expect(res.status).toBe("LIKELY_ACTIVE");
      expect(res.confidence).toBe(0.75);
    });
  });
});
