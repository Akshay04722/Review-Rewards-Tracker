"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  Clock,
  ShieldAlert,
  Users,
  CheckCircle2,
  AlertTriangle,
  History,
  Building,
  Globe,
  Share2,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { PlatformBadge } from "@/components/PlatformBadge";
import { RewardBadge } from "@/components/RewardBadge";
import { formatDate, timeAgo } from "@/lib/utils";

export default function CampaignDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [campaign, setCampaign] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reporting modal state
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  useEffect(() => {
    async function loadCampaign() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/campaigns/${id}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Campaign not found");
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setCampaign(data.data);
      } catch (err: any) {
        setError(err.message || "Failed to load campaign");
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      loadCampaign();
    }
  }, [id]);

  const handleReportExpired = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReport(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/report-expired`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason || "Reported as expired by community user" }),
      });

      if (!res.ok) throw new Error("Failed to submit report");

      setReportSuccess(true);
      setIsReporting(false);
      // Reload updated campaign details
      const refreshRes = await fetch(`/api/campaigns/${id}`);
      if (refreshRes.ok) {
        const refData = await refreshRes.json();
        setCampaign(refData.data);
      }
    } catch (err: any) {
      alert("Error submitting report: " + err.message);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 animate-pulse space-y-6">
        <div className="w-24 h-6 rounded bg-muted" />
        <div className="h-10 w-2/3 rounded-xl bg-muted" />
        <div className="h-64 rounded-3xl bg-muted" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">{error || "Campaign Not Found"}</h2>
        <p className="text-sm text-muted-foreground">
          The campaign you requested does not exist or may have been removed.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tracker</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to all campaigns</span>
        </Link>
      </div>

      {/* Main Campaign Hero Card */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-10 shadow-xs space-y-6 relative overflow-hidden">
        {/* Header badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-5">
          <div className="flex items-center gap-2.5">
            <PlatformBadge platform={campaign.platform} className="text-sm px-3 py-1" />
            <StatusBadge
              status={campaign.status}
              confidence={campaign.confidence}
              className="text-xs px-3 py-1"
            />
          </div>

          <RewardBadge
            amount={campaign.rewardAmount}
            currency={campaign.rewardCurrency}
            rewardType={campaign.rewardType}
            size="lg"
          />
        </div>

        {/* Title and Vendor Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Building className="w-4 h-4 text-primary" />
            <span>{campaign.vendor.name}</span>
            {campaign.vendor.domain && (
              <span className="text-muted-foreground/60">({campaign.vendor.domain})</span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {campaign.productName}
          </h1>
          <p className="text-sm text-muted-foreground italic">{campaign.pageTitle}</p>
        </div>

        {/* Verification Status Reason & Confidence */}
        <div className="rounded-2xl bg-muted/40 p-4 border border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Verification Assessment
            </div>
            <p className="text-xs sm:text-sm text-foreground font-medium">
              {campaign.statusReason || "Listing evaluated and verified through automated multi-gate pipeline."}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-card">
            <span className="text-xs text-muted-foreground font-semibold">Confidence:</span>
            <span className="text-xs font-black text-primary">
              {(campaign.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="rounded-2xl bg-muted/40 p-5 border border-border/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Campaign Summary
          </h3>
          <p className="text-sm sm:text-base text-foreground leading-relaxed">
            {campaign.description}
          </p>
        </div>

        {/* Extracted Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          <div className="rounded-xl border border-border/60 p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <Calendar className="w-4 h-4 text-primary" />
              <span>Deadline</span>
            </div>
            <div className="text-sm font-semibold text-foreground">
              {formatDate(campaign.deadlineDate)}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <Users className="w-4 h-4 text-amber-500" />
              <span>Reward Limit</span>
            </div>
            <div className="text-sm font-semibold text-foreground">
              {campaign.rewardLimit || "None specified / Open"}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Eligibility</span>
            </div>
            <div className="text-sm font-semibold text-foreground">
              {campaign.eligibility || "Open to all verified product users"}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-indigo-500" />
              <span>Last Re-verified</span>
            </div>
            <div className="text-sm font-semibold text-foreground">
              {timeAgo(campaign.lastCheckedAt)}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <Globe className="w-4 h-4 text-sky-500" />
              <span>Canonical Page</span>
            </div>
            <a
              href={campaign.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline truncate block"
            >
              {campaign.canonicalUrl}
            </a>
          </div>

          <div className="rounded-xl border border-border/60 p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <History className="w-4 h-4 text-purple-500" />
              <span>First Discovered</span>
            </div>
            <div className="text-sm font-semibold text-foreground">
              {formatDate(campaign.firstSeenAt)}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/60">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setIsReporting(true)}
              className="text-xs font-semibold px-4 py-2.5 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Report as Expired</span>
            </button>
            {reportSuccess && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Thank you! Campaign flagged as expired.
              </span>
            )}
          </div>

          <a
            href={campaign.directCampaignUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 transition-all hover:scale-[1.02]"
          >
            <span>Open Campaign Page</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Status History Timeline */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 space-y-5 shadow-xs">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Verification & Status History</h2>
        </div>

        {campaign.statusHistory && campaign.statusHistory.length > 0 ? (
          <div className="space-y-4">
            {campaign.statusHistory.map((item: any, idx: number) => (
              <div
                key={item.id || idx}
                className="flex items-start gap-4 p-4 rounded-xl border border-border/60 bg-muted/20"
              >
                <div className="mt-0.5">
                  <StatusBadge status={item.newStatus} confidence={item.confidence} />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-foreground font-medium">{item.reason}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Checked {new Date(item.checkedAt).toLocaleString()}
                    {item.previousStatus && (
                      <span className="ml-2 font-normal">
                        (Transitioned from <span className="font-semibold">{item.previousStatus}</span>)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No previous status transitions recorded.</p>
        )}
      </div>

      {/* Report Expired Modal */}
      {isReporting && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">Report Campaign as Expired</h3>
              <p className="text-xs text-muted-foreground">
                Help the community keep listings accurate. Did this offer end or ran out of cards?
              </p>
            </div>

            <form onSubmit={handleReportExpired} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Reason / Observation</label>
                <textarea
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="e.g. Survey form says closed, or landing page returns 404"
                  className="w-full mt-1 p-2.5 text-xs bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary/40 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReporting(false)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isSubmittingReport ? "Submitting..." : "Confirm Expired"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
