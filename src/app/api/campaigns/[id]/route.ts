import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        vendor: true,
        statusHistory: {
          orderBy: { checkedAt: "desc" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: campaign });
  } catch (error: any) {
    console.error(`GET /api/campaigns/${params.id} error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch campaign details", details: error.message },
      { status: 500 }
    );
  }
}
