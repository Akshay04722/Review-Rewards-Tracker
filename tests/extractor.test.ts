import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { extractCampaignWithHeuristics } from "../src/lib/crawler/extractor";

describe("Campaign Extractor", () => {
  it("should correctly extract G2 campaign details from HTML fixture", () => {
    const fixturePath = path.join(__dirname, "fixtures", "active_g2_datadog.html");
    const html = fs.readFileSync(fixturePath, "utf-8");
    const url = "https://www.datadoghq.com/rewards/g2-review?utm_source=email&utm_campaign=q4";

    const extracted = extractCampaignWithHeuristics(html, url);

    expect(extracted).not.toBeNull();
    if (!extracted) return;

    expect(extracted.vendorName).toBe("Datadog");
    expect(extracted.platform).toBe("G2");
    expect(extracted.rewardAmount).toBe(25);
    expect(extracted.rewardCurrency).toBe("USD");
    expect(extracted.rewardType).toBe("Amazon");
    expect(extracted.directCampaignUrl).toBe(
      "https://www.g2.com/products/datadog/take_survey?campaign=partner_incentive_q4"
    );
    expect(extracted.rewardLimit).toContain("First 50 reviewers");
    expect(extracted.eligibility).toContain("Current customers only");
    expect(extracted.deadlineDate).toBeInstanceOf(Date);
    expect(extracted.deadlineDate?.getFullYear()).toBe(2026);
    expect(extracted.canonicalUrl).toBe("https://www.datadoghq.com/rewards/g2-review");
    expect(extracted.description.length).toBeLessThanOrEqual(300);
  });

  it("should extract TrustRadius campaign details and Visa card", () => {
    const fixturePath = path.join(__dirname, "fixtures", "trustradius_giftcard.html");
    const html = fs.readFileSync(fixturePath, "utf-8");
    const url = "https://sentry.io/review-rewards-trustradius";

    const extracted = extractCampaignWithHeuristics(html, url);

    expect(extracted).not.toBeNull();
    if (!extracted) return;

    expect(extracted.vendorName).toBe("Sentry");
    expect(extracted.platform).toBe("TrustRadius");
    expect(extracted.rewardAmount).toBe(30);
    expect(extracted.rewardType).toBe("Visa");
    expect(extracted.directCampaignUrl).toBe(
      "https://www.trustradius.com/vendor/survey/sentry-q4-incentive"
    );
    expect(extracted.rewardLimit).toContain("First 100 reviewers");
  });

  it("should reject FAQ and documentation pages", () => {
    const faqHtml = `
      <html>
        <head><title>Frequently Asked Questions - Review Rewards Program FAQ</title></head>
        <body>
          <h1>Rewards Program FAQ</h1>
          <div class="faq">
            <h3>How do I earn a $25 Amazon gift card review reward?</h3>
            <p>You can write a review on G2 when an invite is received.</p>
          </div>
          <a href="https://www.g2.com/products/test/take_survey">Take Survey</a>
        </body>
      </html>
    `;
    const res = extractCampaignWithHeuristics(faqHtml, "https://example.com/support/faq");
    expect(res).toBeNull();
  });

  it("should reject pages that only have generic review directory links", () => {
    const directoryHtml = `
      <html>
        <head><title>Acme Software Reviews</title></head>
        <body>
          <h1>See what users say about Acme</h1>
          <p>Read our reviews on G2. We give rewards to our users.</p>
          <a href="https://www.g2.com/products/acme/reviews">Check reviews on G2</a>
        </body>
      </html>
    `;
    const res = extractCampaignWithHeuristics(directoryHtml, "https://acme.com/reviews");
    expect(res).toBeNull();
  });

  it("should reject pricing and subscription plans with $29/mo", () => {
    const pricingHtml = `
      <html>
        <head><title>Acme Pricing and Plans</title></head>
        <body>
          <h1>Acme Pricing</h1>
          <p>Special review incentive discount: $29/mo billed annually. Save $50 on subscription.</p>
          <a href="https://www.g2.com/products/acme/take_survey">Review us on G2</a>
        </body>
      </html>
    `;
    const res = extractCampaignWithHeuristics(pricingHtml, "https://acme.com/pricing");
    expect(res).toBeNull();
  });
});

