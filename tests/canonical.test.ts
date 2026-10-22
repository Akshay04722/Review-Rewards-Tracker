import { describe, it, expect } from "vitest";
import { normalizeCanonicalUrl } from "../src/lib/crawler/canonical";

describe("Canonical URL Normalizer", () => {
  it("should strip UTM and marketing parameters and normalize hostname", () => {
    const raw = "https://WWW.DataDogHQ.COM:443/reviews/g2?utm_source=email&utm_campaign=q4&ref=newsletter#cta-section";
    const canonical = normalizeCanonicalUrl(raw);
    expect(canonical).toBe("https://www.datadoghq.com/reviews/g2");
  });

  it("should remove trailing slashes from paths", () => {
    const raw = "https://asana.com/community/capterra-rewards/";
    const canonical = normalizeCanonicalUrl(raw);
    expect(canonical).toBe("https://asana.com/community/capterra-rewards");
  });

  it("should keep non-tracking query parameters sorted", () => {
    const raw = "https://example.com/survey?b=2&a=1&utm_medium=cpc";
    const canonical = normalizeCanonicalUrl(raw);
    expect(canonical).toBe("https://example.com/survey?a=1&b=2");
  });
});
