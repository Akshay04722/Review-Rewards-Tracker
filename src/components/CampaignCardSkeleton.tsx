import React from "react";

export function CampaignCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="w-16 h-6 rounded-md bg-muted" />
          <div className="w-20 h-6 rounded-full bg-muted" />
        </div>
        <div className="w-24 h-7 rounded-lg bg-muted" />
      </div>

      <div className="space-y-2">
        <div className="w-24 h-3 rounded bg-muted" />
        <div className="w-3/4 h-5 rounded bg-muted" />
      </div>

      <div className="space-y-2 py-2">
        <div className="w-full h-3.5 rounded bg-muted" />
        <div className="w-5/6 h-3.5 rounded bg-muted" />
        <div className="w-2/3 h-3.5 rounded bg-muted" />
      </div>

      <div className="pt-2 border-t border-border/40 flex justify-between items-center">
        <div className="w-24 h-4 rounded bg-muted" />
        <div className="w-28 h-8 rounded-lg bg-muted" />
      </div>
    </div>
  );
}
