import * as cheerio from "cheerio";
import prisma from "../prisma";
import { normalizeCanonicalUrl } from "./canonical";
import { generateSearchQueries, getSearchProvider } from "./search-providers";
import { pageFetcher } from "./fetcher";
import { extractCampaign } from "./extractor";
import { isValidCandidateUrl } from "./domain-filter";

export interface CrawlRunResult {
  runId: string;
  searchesUsed: number;
  totalCandidates: number;
  droppedCount: number;
  rejectedCount: number;
  extractedCount: number;
  verifiedCount: number;
  savedCount: number;
  errorCount: number;
  dropReasons: Record<string, number>;
  statusCounts: Record<string, number>;
  errors: string[];
}

export class CrawlerOrchestrator {
  /**
   * Run full discovery & crawl pipeline with SerpAPI quota controls, dual-pass freshness (qdr:m and qdr:y),
   * deep 1-level crawling on hub pages, and strict validation.
   */
  async runDiscovery(trigger: "SCHEDULED" | "MANUAL" | "CLI" = "MANUAL"): Promise<CrawlRunResult> {
    const crawlRun = await prisma.crawlRun.create({
      data: {
        trigger,
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    const errors: string[] = [];
    const discoveredCandidates = new Set<string>();
    const dropReasons: Record<string, number> = {};
    const statusCounts: Record<string, number> = {
      ACTIVE: 0,
      LIKELY_ACTIVE: 0,
      EXPIRED: 0,
    };

    let droppedCount = 0;
    let rejectedCount = 0;
    let extractedCount = 0;
    let verifiedCount = 0;
    let savedCount = 0;

    const recordDropReason = (reason: string) => {
      droppedCount++;
      dropReasons[reason] = (dropReasons[reason] || 0) + 1;
    };

    const maxSearchesPerRun = parseInt(process.env.MAX_SEARCHES_PER_RUN || "40", 10);
    let searchesPerformed = 0;

    try {
      const searchProvider = getSearchProvider();

      // 1. Quota Pre-check on SerpAPI account endpoint
      if (searchProvider.getRemainingQuota) {
        const remaining = await searchProvider.getRemainingQuota();
        if (remaining !== null) {
          console.log(`[Crawler] SerpAPI Account Quota: ${remaining} searches remaining.`);
          if (remaining < 10) {
            const quotaWarning = `[SerpAPI Quota Alert] Remaining quota is ${remaining} (<10). Halting crawl run.`;
            console.warn(quotaWarning);
            errors.push(quotaWarning);

            await prisma.crawlRun.update({
              where: { id: crawlRun.id },
              data: {
                status: "COMPLETED",
                endedAt: new Date(),
                totalCandidates: 0,
                errorCount: 1,
                logs: JSON.stringify(errors),
              },
            });

            return {
              runId: crawlRun.id,
              searchesUsed: 0,
              totalCandidates: 0,
              droppedCount: 0,
              rejectedCount: 0,
              extractedCount: 0,
              verifiedCount: 0,
              savedCount: 0,
              errorCount: 1,
              dropReasons: {},
              statusCounts: {},
              errors,
            };
          }
        }
      }

      // 2. Fetch existing campaigns & rejected URLs to skip
      const existingCampaigns = await prisma.campaign.findMany({
        select: { canonicalUrl: true },
      });
      const knownCampaignUrls = new Set(existingCampaigns.map((c) => c.canonicalUrl));

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentRejections = await prisma.rejectedUrl.findMany({
        where: { checkedAt: { gte: sevenDaysAgo } },
        select: { url: true },
      });
      const recentlyRejectedUrls = new Set(recentRejections.map((r) => r.url));

      // 3. Generate queries from queries.json and template configuration
      const queries = generateSearchQueries();
      console.log(`[Crawler] Generated ${queries.length} queries to execute.`);

      // 4. Two passes: tbs=qdr:m (freshest past month), then tbs=qdr:y (older but possibly live)
      const tbsPasses = ["qdr:m", "qdr:y"];

      passLoop: for (const tbs of tbsPasses) {
        for (const query of queries) {
          if (searchesPerformed >= maxSearchesPerRun) {
            console.log(`[Crawler] Reached MAX_SEARCHES_PER_RUN (${maxSearchesPerRun}). Stopping search.`);
            break passLoop;
          }

          // Up to 2 pages per query (offset 0, 10)
          for (let pageIdx = 0; pageIdx < 2; pageIdx++) {
            if (searchesPerformed >= maxSearchesPerRun) break passLoop;

            const offset = pageIdx * 10;
            try {
              searchesPerformed++;
              const results = await searchProvider.search(query, {
                limit: 10,
                offset,
                hl: "en",
                gl: "us",
                tbs,
              });

              for (const item of results) {
                if (!item.url || !isValidCandidateUrl(item.url)) {
                  continue;
                }
                const canonical = normalizeCanonicalUrl(item.url);
                if (!isValidCandidateUrl(canonical)) {
                  continue;
                }
                if (knownCampaignUrls.has(canonical) || recentlyRejectedUrls.has(canonical)) {
                  continue;
                }
                discoveredCandidates.add(canonical);
              }

              if (results.length < 10) {
                break;
              }
            } catch (searchErr: any) {
              const msg = `Search query failed "${query}" (${tbs}, page ${pageIdx + 1}): ${
                searchErr.message || searchErr
              }`;
              errors.push(msg);
              console.warn(msg);
              break;
            }
          }
        }
      }

      console.log(
        `[Crawler] Discovery complete. Discovered ${discoveredCandidates.size} candidate URLs (Searches performed: ${searchesPerformed}).`
      );

      // 5. Candidate processing queue (supports 1-level deep expansion)
      const candidateQueue = Array.from(discoveredCandidates);
      const visitedUrls = new Set<string>();

      while (candidateQueue.length > 0) {
        const url = candidateQueue.shift()!;
        if (visitedUrls.has(url)) continue;
        visitedUrls.add(url);

        try {
          if (!isValidCandidateUrl(url)) {
            rejectedCount++;
            continue;
          }

          // Fetch page with undici + redirect tracking + soft-404 check
          const fetchRes = await pageFetcher.fetchPage(url);
          if (fetchRes.dropped) {
            recordDropReason(fetchRes.dropReason || "Dropped candidate");
            continue;
          }

          // Crawl one level deeper if candidate is a vendor Hub/Rewards/Reviews page
          const urlLower = url.toLowerCase();
          const isHubPage =
            urlLower.includes("/hub") ||
            urlLower.includes("/customer") ||
            urlLower.includes("/rewards") ||
            urlLower.includes("/reviews") ||
            urlLower.includes("/advocate") ||
            urlLower.includes("/community");

          if (isHubPage && fetchRes.html) {
            try {
              const $ = cheerio.load(fetchRes.html);
              const originHost = new URL(url).hostname.toLowerCase();
              let deepAdded = 0;

              $("a[href]").each((_, el) => {
                if (deepAdded >= 5) return false;
                const href = $(el).attr("href");
                const text = $(el).text().toLowerCase();
                if (!href) return;

                let absUrl: string;
                try {
                  absUrl = new URL(href, url).toString();
                } catch {
                  return;
                }

                // Must be same domain
                const linkHost = new URL(absUrl).hostname.toLowerCase();
                if (linkHost !== originHost && !linkHost.endsWith("." + originHost)) {
                  return;
                }

                const hrefLower = absUrl.toLowerCase();
                const isRelevantLink =
                  hrefLower.includes("g2") ||
                  hrefLower.includes("review") ||
                  hrefLower.includes("reward") ||
                  text.includes("g2") ||
                  text.includes("review") ||
                  text.includes("reward");

                if (isRelevantLink && isValidCandidateUrl(absUrl)) {
                  const canonicalDeep = normalizeCanonicalUrl(absUrl);
                  if (!visitedUrls.has(canonicalDeep) && !discoveredCandidates.has(canonicalDeep)) {
                    candidateQueue.push(canonicalDeep);
                    discoveredCandidates.add(canonicalDeep);
                    deepAdded++;
                  }
                }
              });
            } catch (deepErr) {
              // Ignore deeper parsing errors
            }
          }

          // Extract campaign details & validate through relevance gate
          const extracted = await extractCampaign(
            fetchRes.html,
            fetchRes.finalUrl || url,
            fetchRes.lastModified
          );

          if (!extracted) {
            rejectedCount++;
            continue;
          }

          extractedCount++;

          // Deduplicate by (vendor + platform + reward)
          const existingSameOffering = await prisma.campaign.findFirst({
            where: {
              vendor: { name: extracted.vendorName },
              platform: extracted.platform,
              rewardAmount: extracted.rewardAmount,
            },
            include: { vendor: true },
          });

          // Upsert Vendor
          const vendor = await prisma.vendor.upsert({
            where: { name: extracted.vendorName },
            create: {
              name: extracted.vendorName,
              domain: new URL(extracted.canonicalUrl).hostname,
            },
            update: {},
          });

          const existingByCanonical = await prisma.campaign.findUnique({
            where: { canonicalUrl: extracted.canonicalUrl },
          });

          // If another page already exists for this vendor+platform+reward, update the existing entry to the newest URL
          const targetCampaignId = existingByCanonical?.id || existingSameOffering?.id;

          const campaignData = {
            vendorId: vendor.id,
            productName: extracted.productName,
            pageTitle: extracted.pageTitle,
            canonicalUrl: extracted.canonicalUrl,
            platform: extracted.platform,
            directCampaignUrl: extracted.directCampaignUrl,
            rewardAmount: extracted.rewardAmount,
            rewardCurrency: extracted.rewardCurrency,
            rewardType: extracted.rewardType,
            description: extracted.description,
            rewardLimit: extracted.rewardLimit,
            eligibility: extracted.eligibility,
            deadlineDate: extracted.deadlineDate,
            status: extracted.status,
            confidence: extracted.confidence,
            statusReason: extracted.statusReason,
            qualityScore: extracted.qualityScore,
            linkBroken: extracted.linkBroken,
            evidence: JSON.stringify(extracted.evidence),
            consecutiveFails: 0,
            lastCheckedAt: new Date(),
            lastSeenAt: new Date(),
          };

          let campaignRecord;
          if (targetCampaignId) {
            campaignRecord = await prisma.campaign.update({
              where: { id: targetCampaignId },
              data: campaignData,
            });
          } else {
            campaignRecord = await prisma.campaign.create({
              data: campaignData,
            });
          }

          verifiedCount++;
          savedCount++;
          statusCounts[extracted.status] = (statusCounts[extracted.status] || 0) + 1;

          // Record Status History if new or status transitioned
          const previousStatus = existingByCanonical?.status || existingSameOffering?.status || null;
          if (!previousStatus || previousStatus !== extracted.status) {
            await prisma.statusHistory.create({
              data: {
                campaignId: campaignRecord.id,
                previousStatus,
                newStatus: extracted.status,
                confidence: extracted.confidence,
                reason: extracted.statusReason,
                checkedAt: new Date(),
              },
            });
          }
        } catch (itemErr: any) {
          const errStr = `Error processing ${url}: ${itemErr.message || itemErr}`;
          errors.push(errStr);
          console.warn(errStr);
        }
      }

      // Mark run as completed with complete observability summary
      await prisma.crawlRun.update({
        where: { id: crawlRun.id },
        data: {
          status: "COMPLETED",
          endedAt: new Date(),
          searchesUsed: searchesPerformed,
          totalCandidates: discoveredCandidates.size,
          droppedCount,
          rejectedCount,
          extractedCount,
          verifiedCount,
          savedCount,
          errorCount: errors.length,
          dropReasons: JSON.stringify(dropReasons),
          statusCounts: JSON.stringify(statusCounts),
          logs: JSON.stringify(errors.slice(0, 50)),
        },
      });

      return {
        runId: crawlRun.id,
        searchesUsed: searchesPerformed,
        totalCandidates: discoveredCandidates.size,
        droppedCount,
        rejectedCount,
        extractedCount,
        verifiedCount,
        savedCount,
        errorCount: errors.length,
        dropReasons,
        statusCounts,
        errors,
      };
    } catch (crawlErr: any) {
      await prisma.crawlRun.update({
        where: { id: crawlRun.id },
        data: {
          status: "FAILED",
          endedAt: new Date(),
          searchesUsed: searchesPerformed,
          errorCount: errors.length + 1,
          logs: JSON.stringify([...errors, crawlErr.message || String(crawlErr)]),
        },
      });
      throw crawlErr;
    }
  }

  /**
   * Re-verify all existing campaigns older than 24 hours.
   * A listing that fails fetch twice in a row is removed from the public list and moved to RejectedUrl.
   */
  async reVerifyCampaigns(): Promise<{ verified: number; expired: number; removed: number }> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const staleCampaigns = await prisma.campaign.findMany({
      where: {
        lastCheckedAt: {
          lt: oneDayAgo,
        },
      },
    });

    let verified = 0;
    let expired = 0;
    let removed = 0;

    for (const campaign of staleCampaigns) {
      try {
        const fetchRes = await pageFetcher.fetchPage(campaign.canonicalUrl);

        // If fetch dropped (e.g. 404, soft-404, timeout) or consecutive fails >= 1
        if (fetchRes.dropped || fetchRes.statusCode >= 400) {
          const newFails = campaign.consecutiveFails + 1;
          if (newFails >= 2) {
            // Failed twice in a row: remove from public list and record in RejectedUrl
            console.log(`[ReVerify] Campaign ${campaign.canonicalUrl} failed twice. Moving to RejectedUrl and removing.`);
            await prisma.rejectedUrl.upsert({
              where: { url: campaign.canonicalUrl },
              create: {
                url: campaign.canonicalUrl,
                reason: `Failed verification checks twice in a row (${fetchRes.dropReason || "HTTP error"})`,
                checkedAt: new Date(),
              },
              update: {
                reason: `Failed verification checks twice in a row (${fetchRes.dropReason || "HTTP error"})`,
                checkedAt: new Date(),
              },
            });
            await prisma.campaign.delete({ where: { id: campaign.id } });
            removed++;
            continue;
          } else {
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: {
                consecutiveFails: newFails,
                lastCheckedAt: new Date(),
              },
            });
            continue;
          }
        }

        // Deep re-verify using extractCampaign
        const extracted = await extractCampaign(
          fetchRes.html,
          fetchRes.finalUrl || campaign.canonicalUrl,
          fetchRes.lastModified
        );

        if (!extracted) {
          const newFails = campaign.consecutiveFails + 1;
          if (newFails >= 2) {
            await prisma.rejectedUrl.upsert({
              where: { url: campaign.canonicalUrl },
              create: {
                url: campaign.canonicalUrl,
                reason: "Failed extraction/relevance checks twice in a row",
                checkedAt: new Date(),
              },
              update: {
                reason: "Failed extraction/relevance checks twice in a row",
                checkedAt: new Date(),
              },
            });
            await prisma.campaign.delete({ where: { id: campaign.id } });
            removed++;
            continue;
          }
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: { consecutiveFails: newFails, lastCheckedAt: new Date() },
          });
          continue;
        }

        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            status: extracted.status,
            confidence: extracted.confidence,
            statusReason: extracted.statusReason,
            qualityScore: extracted.qualityScore,
            linkBroken: extracted.linkBroken,
            consecutiveFails: 0,
            lastCheckedAt: new Date(),
            ...(extracted.status !== "EXPIRED" ? { lastSeenAt: new Date() } : {}),
          },
        });

        if (campaign.status !== extracted.status) {
          await prisma.statusHistory.create({
            data: {
              campaignId: campaign.id,
              previousStatus: campaign.status,
              newStatus: extracted.status,
              confidence: extracted.confidence,
              reason: extracted.statusReason,
            },
          });
        }

        if (extracted.status === "EXPIRED") expired++;
        else verified++;
      } catch (err) {
        console.warn(`Re-verify error on campaign ${campaign.id}:`, err);
      }
    }

    return { verified, expired, removed };
  }
}

export const orchestrator = new CrawlerOrchestrator();
