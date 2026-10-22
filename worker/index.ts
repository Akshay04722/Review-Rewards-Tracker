import cron from "node-cron";
import dotenv from "dotenv";
dotenv.config();

import { orchestrator } from "../src/lib/crawler/orchestrator";

console.log("--------------------------------------------------");
console.log(" ReviewRewards Tracker - Worker Daemon Initialized");
console.log(` Search Provider: ${process.env.SEARCH_PROVIDER || "mock"}`);
console.log("--------------------------------------------------");

let isRunningDiscovery = false;
let isRunningReverify = false;

// 1. Discovery Cron Job (default: every 6 hours, e.g. "0 */6 * * *", or "*/30 * * * *" in dev)
const discoverySchedule = process.env.DISCOVERY_CRON || "0 */6 * * *";
cron.schedule(discoverySchedule, async () => {
  if (isRunningDiscovery) {
    console.log("[Worker] Discovery already in progress. Skipping cycle.");
    return;
  }

  console.log(`[Worker] Starting scheduled discovery crawl at ${new Date().toISOString()}...`);
  isRunningDiscovery = true;

  try {
    const result = await orchestrator.runDiscovery("SCHEDULED");
    console.log(
      `[Worker] Scheduled discovery finished. Candidates: ${result.totalCandidates}, Extracted: ${result.extractedCount}, Verified: ${result.verifiedCount}, Errors: ${result.errorCount}`
    );
  } catch (err) {
    console.error("[Worker] Scheduled discovery encountered an error:", err);
  } finally {
    isRunningDiscovery = false;
  }
});

// 2. Re-verification Cron Job (every 24 hours: "0 0 * * *")
const reverifySchedule = process.env.REVERIFY_CRON || "0 0 * * *";
cron.schedule(reverifySchedule, async () => {
  if (isRunningReverify) {
    console.log("[Worker] Re-verification already in progress. Skipping cycle.");
    return;
  }

  console.log(`[Worker] Starting 24h campaign re-verification at ${new Date().toISOString()}...`);
  isRunningReverify = true;

  try {
    const result = await orchestrator.reVerifyCampaigns();
    console.log(
      `[Worker] Re-verification finished. Verified: ${result.verified}, Marked Expired: ${result.expired}`
    );
  } catch (err) {
    console.error("[Worker] Campaign re-verification encountered an error:", err);
  } finally {
    isRunningReverify = false;
  }
});

// Run an initial discovery pass on worker boot if configured
if (process.env.RUN_CRAWL_ON_STARTUP === "true") {
  console.log("[Worker] RUN_CRAWL_ON_STARTUP=true -> Triggering initial discovery run...");
  orchestrator
    .runDiscovery("SCHEDULED")
    .then((res) => {
      console.log(
        `[Worker] Initial discovery complete: ${res.verifiedCount} verified campaigns saved.`
      );
    })
    .catch((err) => {
      console.error("[Worker] Initial discovery error:", err);
    });
}

// Graceful termination handling
const handleShutdown = (signal: string) => {
  console.log(`[Worker] Received ${signal}. Shutting down worker gracefully...`);
  process.exit(0);
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
