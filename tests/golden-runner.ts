import fs from "fs";
import path from "path";
import { pageFetcher } from "../src/lib/crawler/fetcher";
import { checkRelevanceGate } from "../src/lib/crawler/relevance-gate";
import { extractCampaign } from "../src/lib/crawler/extractor";
import { detectSoft404 } from "../src/lib/crawler/soft-404";
import { isDisallowedFinalUrl } from "../src/lib/crawler/domain-filter";

interface GoldenEntry {
  url: string;
  expected: "ACTIVE_OR_LIKELY" | "EXPIRED" | "REJECTED";
  notes?: string;
}

function getFixtureFileName(url: string): string {
  return url.replace(/https?:\/\//, "").replace(/[^a-zA-Z0-9]/g, "_") + ".html";
}

async function loadPageHtml(url: string): Promise<{ html: string; dropped: boolean; dropReason?: string }> {
  // Check if saved fixture exists in fixtures/golden-html/
  const fixtureName = getFixtureFileName(url);
  const fixturePath = path.resolve(process.cwd(), "fixtures", "golden-html", fixtureName);

  if (fs.existsSync(fixturePath)) {
    const html = fs.readFileSync(fixturePath, "utf-8");
    // Check soft-404 on fixture
    const soft = detectSoft404(html);
    if (soft.isSoft404) {
      return { html, dropped: true, dropReason: soft.reason };
    }
    const finalCheck = isDisallowedFinalUrl(url);
    if (finalCheck.disallowed) {
      return { html, dropped: true, dropReason: finalCheck.reason };
    }
    return { html, dropped: false };
  }

  // Fallback to fetcher
  try {
    const res = await pageFetcher.fetchPage(url);
    if (res.dropped) {
      return { html: res.html, dropped: true, dropReason: res.dropReason };
    }
    return { html: res.html, dropped: false };
  } catch (err: any) {
    return { html: "", dropped: true, dropReason: err.message || "Fetch failed" };
  }
}

async function runGoldenTests() {
  console.log("===============================================================");
  console.log("   ReviewRewards Tracker - Golden Set Accuracy Evaluation");
  console.log("===============================================================\n");

  const goldenPath = path.resolve(process.cwd(), "fixtures", "golden.json");
  if (!fs.existsSync(goldenPath)) {
    console.error(`fixtures/golden.json not found at ${goldenPath}`);
    process.exit(1);
  }

  const goldenData: GoldenEntry[] = JSON.parse(fs.readFileSync(goldenPath, "utf-8"));

  let tp = 0; // Truly genuine campaigns correctly accepted
  let fp = 0; // Irrelevant/junk pages wrongly accepted
  let tn = 0; // Irrelevant pages correctly rejected
  let fn = 0; // Genuine campaigns wrongly rejected
  let statusMatches = 0;

  const results: any[] = [];

  for (const item of goldenData) {
    const { url, expected } = item;
    let actual: "ACTIVE" | "LIKELY_ACTIVE" | "EXPIRED" | "REJECTED" = "REJECTED";
    let detail = "";

    const loaded = await loadPageHtml(url);

    if (loaded.dropped) {
      actual = "REJECTED";
      detail = loaded.dropReason || "Dropped by fetcher";
    } else {
      // 1. Relevance gate
      const relevance = checkRelevanceGate(loaded.html, url);
      if (!relevance.passed) {
        actual = "REJECTED";
        detail = relevance.rejectionReason || "Failed relevance gate";
      } else {
        // 2. Structured extraction & status evaluation
        const extracted = await extractCampaign(loaded.html, url);
        if (!extracted) {
          actual = "REJECTED";
          detail = "Failed extraction or qualityScore < 0.6";
        } else {
          actual = extracted.status as any;
          detail = `Extracted ${extracted.platform} ($${extracted.rewardAmount} ${extracted.rewardType}) - ${extracted.statusReason}`;
        }
      }
    }

    // Evaluation
    let passed = false;
    if (expected === "ACTIVE_OR_LIKELY") {
      if (actual === "ACTIVE" || actual === "LIKELY_ACTIVE") {
        passed = true;
        tp++;
        statusMatches++;
      } else if (actual === "EXPIRED") {
        // Accepted campaign but status was expired
        tp++;
        detail += " (Status was EXPIRED instead of ACTIVE)";
      } else {
        fn++;
      }
    } else if (expected === "EXPIRED") {
      if (actual === "EXPIRED") {
        passed = true;
        tp++;
        statusMatches++;
      } else if (actual === "ACTIVE" || actual === "LIKELY_ACTIVE") {
        tp++;
        detail += " (Status was ACTIVE instead of EXPIRED)";
      } else {
        fn++;
      }
    } else if (expected === "REJECTED") {
      if (actual === "REJECTED") {
        passed = true;
        tn++;
      } else {
        fp++;
      }
    }

    results.push({
      url: url.replace(/^https?:\/\//, ""),
      expected,
      actual,
      passed,
      detail,
    });
  }

  // Print summary table
  console.log(
    "URL".padEnd(46) +
    "Expected".padEnd(18) +
    "Actual".padEnd(16) +
    "Result"
  );
  console.log("-".repeat(88));

  for (const r of results) {
    const symbol = r.passed ? "✔ PASS" : "✖ FAIL";
    const shortUrl = r.url.length > 44 ? r.url.slice(0, 41) + "..." : r.url;
    console.log(
      shortUrl.padEnd(46) +
      r.expected.padEnd(18) +
      r.actual.padEnd(16) +
      symbol
    );
    if (!r.passed) {
      console.log(`   └─ Note: ${r.detail}`);
    }
  }

  const total = goldenData.length;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 1;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 1;
  const accuracy = (tp + tn) / total;

  console.log("\n===============================================================");
  console.log(`   Total Golden Set: ${total}`);
  console.log(`   True Positives (TP):  ${tp}  (Expected campaigns accepted)`);
  console.log(`   False Positives (FP): ${fp}  (Junk/deals wrongly accepted)`);
  console.log(`   True Negatives (TN):  ${tn}  (Junk/deals correctly rejected)`);
  console.log(`   False Negatives (FN): ${fn}  (Expected campaigns missed)`);
  console.log("---------------------------------------------------------------");
  console.log(`   Precision:        ${(precision * 100).toFixed(1)}%   (Target: >= 90.0%)`);
  console.log(`   Recall:           ${(recall * 100).toFixed(1)}%`);
  console.log(`   Overall Accuracy: ${(accuracy * 100).toFixed(1)}%`);
  console.log("===============================================================\n");

  if (precision < 0.9) {
    console.error(`❌ TEST FAILED: Precision ${(precision * 100).toFixed(1)}% is below required 90.0% threshold.`);
    process.exit(1);
  } else {
    console.log(`✅ TEST PASSED: Precision is ${(precision * 100).toFixed(1)}% (>= 90.0%).`);
  }
}

runGoldenTests().catch((err) => {
  console.error("Golden runner error:", err);
  process.exit(1);
});
