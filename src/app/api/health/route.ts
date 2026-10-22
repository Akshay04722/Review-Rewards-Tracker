import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // Check DB connectivity
    const campaignCount = await prisma.campaign.count();
    const lastRun = await prisma.crawlRun.findFirst({
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: "connected",
      campaignCount,
      lastCrawl: lastRun
        ? {
            id: lastRun.id,
            status: lastRun.status,
            startedAt: lastRun.startedAt,
            endedAt: lastRun.endedAt,
          }
        : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        error: error.message || "Database connection failure",
      },
      { status: 500 }
    );
  }
}
