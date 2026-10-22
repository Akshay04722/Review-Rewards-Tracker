import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { orchestrator } from "@/lib/crawler/orchestrator";

function isAuthorized(request: NextRequest): boolean {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return true; // Dev fallback if not set

  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const customHeader = request.headers.get("x-admin-token")?.trim();
  const queryToken = new URL(request.url).searchParams.get("token")?.trim();

  return (
    bearerToken === adminToken ||
    customHeader === adminToken ||
    queryToken === adminToken
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized. Valid ADMIN_TOKEN required." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const trigger = body.trigger === "SCHEDULED" ? "SCHEDULED" : "MANUAL";

    // Run discovery asynchronously or synchronously based on flag
    const asyncMode = body.async === true;

    if (asyncMode) {
      orchestrator.runDiscovery(trigger).catch((err) => {
        console.error("Background crawl error:", err);
      });

      return NextResponse.json({
        message: "Crawl triggered in background",
        status: "RUNNING",
      });
    }

    const result = await orchestrator.runDiscovery(trigger);

    return NextResponse.json({
      message: "Crawl executed successfully",
      result,
    });
  } catch (error: any) {
    console.error("POST /api/admin/crawl error:", error);
    return NextResponse.json(
      { error: "Crawl execution failed", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized. Valid ADMIN_TOKEN required." },
      { status: 401 }
    );
  }

  try {
    const [
      crawlRuns,
      totalCampaigns,
      activeCampaigns,
      likelyActiveCampaigns,
      expiredCampaigns,
      totalRejectedUrls,
      lowestConfidenceCampaigns,
      rejectedUrlSamples,
    ] = await Promise.all([
      prisma.crawlRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 20,
      }),
      prisma.campaign.count(),
      prisma.campaign.count({ where: { status: "ACTIVE" } }),
      prisma.campaign.count({ where: { status: "LIKELY_ACTIVE" } }),
      prisma.campaign.count({ where: { status: "EXPIRED" } }),
      prisma.rejectedUrl.count(),
      prisma.campaign.findMany({
        orderBy: { confidence: "asc" },
        take: 10,
        include: { vendor: { select: { name: true } } },
      }),
      prisma.rejectedUrl.findMany({
        orderBy: { checkedAt: "desc" },
        take: 200,
        select: { reason: true },
      }),
    ]);

    // Aggregate top rejection reasons
    const rejectionCounts: Record<string, number> = {};
    for (const item of rejectedUrlSamples) {
      const reason = item.reason || "Unknown";
      rejectionCounts[reason] = (rejectionCounts[reason] || 0) + 1;
    }

    const topRejections = Object.entries(rejectionCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      stats: {
        totalCampaigns,
        activeCampaigns,
        likelyActiveCampaigns,
        expiredCampaigns,
        totalRejectedUrls,
        totalCrawlRuns: crawlRuns.length,
      },
      topRejections,
      lowestConfidenceCampaigns,
      crawlRuns,
    });
  } catch (error: any) {
    console.error("GET /api/admin/crawl error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve crawl status", details: error.message },
      { status: 500 }
    );
  }
}
