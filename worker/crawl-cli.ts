import dotenv from "dotenv";
dotenv.config();

import { orchestrator } from "../src/lib/crawler/orchestrator";

async function main() {
  console.log("=== ReviewRewards Tracker - CLI Crawl Trigger ===");
  console.log(`Provider: ${process.env.SEARCH_PROVIDER || "mock"}`);
  console.log("Starting discovery and extraction...\n");

  const start = Date.now();
  try {
    const result = await orchestrator.runDiscovery("CLI");
    const duration = ((Date.now() - start) / 1000).toFixed(2);

    console.log("\n--- Crawl Results ---");
    console.log(`Run ID:            ${result.runId}`);
    console.log(`Total Candidates:  ${result.totalCandidates}`);
    console.log(`Extracted Count:   ${result.extractedCount}`);
    console.log(`Verified Count:    ${result.verifiedCount}`);
    console.log(`Error Count:       ${result.errorCount}`);
    console.log(`Execution Time:    ${duration}s`);

    if (result.errors.length > 0) {
      console.log("\nNotices / Errors encountered:");
      result.errors.slice(0, 10).forEach((err, i) => console.log(` ${i + 1}. ${err}`));
    }
  } catch (err) {
    console.error("Fatal error during CLI crawl:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
