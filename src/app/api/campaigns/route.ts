import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const platformParam = searchParams.get("platform");
    const statusParam = searchParams.get("status");
    const minRewardParam = searchParams.get("minReward");
    const rewardTypeParam = searchParams.get("rewardType");
    const queryParam = searchParams.get("q");
    const sortParam = searchParams.get("sort") || "newest";
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const pageSizeParam = parseInt(searchParams.get("pageSize") || "12", 10);

    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
    const pageSize = Math.max(1, Math.min(100, isNaN(pageSizeParam) ? 12 : pageSizeParam));
    const skip = (page - 1) * pageSize;

    const where: Prisma.CampaignWhereInput = {};

    // Filter by Platform (supports multi-select comma separated)
    if (platformParam) {
      const platforms = platformParam.split(",").map((p) => p.trim()).filter(Boolean);
      if (platforms.length > 0) {
        where.platform = { in: platforms };
      }
    }

    const hideExpiredParam = searchParams.get("hideExpired");
    // Hide expired by default unless explicitly disabled or specifically filtering status
    const hideExpired = hideExpiredParam === null ? true : hideExpiredParam === "true";

    // Only EXPIRED, ACTIVE, and LIKELY_ACTIVE with qualityScore >= 0.6 are ever shown
    where.qualityScore = { gte: 0.6 };

    // Filter by Status & Hide Expired
    if (statusParam) {
      const statuses = statusParam.split(",").map((s) => s.trim()).filter(Boolean);
      const validStatuses = statuses.filter((s) => ["ACTIVE", "LIKELY_ACTIVE", "EXPIRED"].includes(s));
      if (validStatuses.length > 0) {
        where.status = { in: validStatuses };
      }
    } else if (hideExpired) {
      where.status = { in: ["ACTIVE", "LIKELY_ACTIVE"] };
    } else {
      where.status = { in: ["ACTIVE", "LIKELY_ACTIVE", "EXPIRED"] };
    }

    // Filter by Minimum Reward Amount
    if (minRewardParam) {
      const minReward = parseFloat(minRewardParam);
      if (!isNaN(minReward) && minReward > 0) {
        where.rewardAmount = { gte: minReward };
      }
    }

    // Filter by Reward Type
    if (rewardTypeParam) {
      const types = rewardTypeParam.split(",").map((t) => t.trim()).filter(Boolean);
      if (types.length > 0) {
        where.rewardType = { in: types };
      }
    }

    // Search Query (case-insensitive across vendor, product, title, description)
    if (queryParam) {
      const q = queryParam.trim();
      where.OR = [
        { productName: { contains: q } },
        { pageTitle: { contains: q } },
        { description: { contains: q } },
        { vendor: { name: { contains: q } } },
      ];
    }

    // Sorting
    let orderBy: Prisma.CampaignOrderByWithRelationInput = { createdAt: "desc" };
    if (sortParam === "reward-desc") {
      orderBy = { rewardAmount: "desc" };
    } else if (sortParam === "reward-asc") {
      orderBy = { rewardAmount: "asc" };
    } else if (sortParam === "deadline") {
      orderBy = { deadlineDate: "asc" };
    } else if (sortParam === "newest") {
      orderBy = { createdAt: "desc" };
    }

    const [total, campaigns] = await Promise.all([
      prisma.campaign.count({ where }),
      prisma.campaign.findMany({
        where,
        include: {
          vendor: {
            select: { id: true, name: true, domain: true },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: campaigns,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: any) {
    console.error("GET /api/campaigns error:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns", details: error.message },
      { status: 500 }
    );
  }
}
