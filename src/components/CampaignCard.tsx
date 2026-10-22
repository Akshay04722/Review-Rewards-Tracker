import React from "react";
import Link from "next/link";
import { ExternalLink, Calendar, Users, ArrowRight } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { PlatformBadge } from "./PlatformBadge";
import { RewardBadge } from "./RewardBadge";
import { formatDate, timeAgo } from "@/lib/utils";

interface CampaignCardProps {
  campaign: {
    id: string;
    productName: string;
    pageTitle: string;
    platform: string;
    directCampaignUrl: string;
    rewardAmount: number;
    rewardCurrency: string;
    rewardType: string;
    description: string;
    rewardLimit?: string | null;
    eligibility?: string | null;
    deadlineDate?: string | Date | null;
    status: string;
    confidence: number;
    lastCheckedAt: string | Date;
    vendor: {
      name: string;
      domain?: string | null;
    };
  };
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const isExpired = campaign.status === "EXPIRED";

  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden bg-card text-card-foreground shadow-xs hover:shadow-md ${
        isExpired
          ? "border-border/60 opacity-75 hover:opacity-100"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="p-5 sm:p-6 space-y-4">
        {/* Top badges bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <PlatformBadge platform={campaign.platform} />
            <StatusBadge status={campaign.status} confidence={campaign.confidence} />
          </div>
          <RewardBadge
            amount={campaign.rewardAmount}
            currency={campaign.rewardCurrency}
            rewardType={campaign.rewardType}
            size="sm"
          />
        </div>

        {/* Vendor & Product Title */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {campaign.vendor.name}
          </div>
          <Link
            href={`/campaigns/${campaign.id}`}
            className="block text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1"
          >
            {campaign.productName}
          </Link>
          <p className="text-xs text-muted-foreground line-clamp-1 italic">
            {campaign.pageTitle}
          </p>
        </div>

        {/* Description */}
        <p className="text-sm text-foreground/85 leading-relaxed line-clamp-3">
          {campaign.description}
        </p>

        {/* Metadata badges: Eligibility, Limit, Deadline */}
        <div className="space-y-2 pt-1 border-t border-border/40 text-xs text-muted-foreground">
          {campaign.deadlineDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Deadline: {formatDate(campaign.deadlineDate)}</span>
            </div>
          )}

          {campaign.rewardLimit && (
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="line-clamp-1">{campaign.rewardLimit}</span>
            </div>
          )}

          {campaign.eligibility && (
            <div className="text-[11px] bg-muted/60 px-2 py-1 rounded-md text-foreground/80 line-clamp-1">
              <span className="font-medium text-foreground">Eligibility:</span> {campaign.eligibility}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="px-5 py-3.5 bg-muted/30 border-t border-border/60 flex items-center justify-between gap-2">
        <Link
          href={`/campaigns/${campaign.id}`}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          <span>Details</span>
          <ArrowRight className="w-3 h-3" />
        </Link>

        <a
          href={campaign.directCampaignUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isExpired
              ? "bg-muted text-muted-foreground hover:bg-muted/80"
              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs hover:shadow-primary/25"
          }`}
        >
          <span>Open campaign</span>
          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
        </a>
      </div>
    </div>
  );
}
