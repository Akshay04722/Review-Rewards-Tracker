import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const userReason = body.reason || "Reported as expired by community user";

    const campaign = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Mark as EXPIRED and record status history
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        status: "EXPIRED",
        confidence: 0.9,
        consecutiveFails: campaign.consecutiveFails + 1,
        lastCheckedAt: new Date(),
      },
    });

    await prisma.statusHistory.create({
      data: {
        campaignId: id,
        previousStatus: campaign.status,
        newStatus: "EXPIRED",
        confidence: 0.9,
        reason: userReason,
        checkedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Campaign reported as expired successfully",
      campaign: updated,
    });
  } catch (error: any) {
    console.error(`POST /api/campaigns/${params.id}/report-expired error:`, error);
    return NextResponse.json(
      { error: "Failed to report campaign", details: error.message },
      { status: 500 }
    );
  }
}
