"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CampaignCard } from "@/components/CampaignCard";
import { CampaignCardSkeleton } from "@/components/CampaignCardSkeleton";
import { FilterSidebar, FilterState } from "@/components/FilterSidebar";
import { Sparkles, LayoutGrid, Table as TableIcon, RefreshCw, AlertCircle } from "lucide-react";

const initialFilters: FilterState = {
  q: "",
  platforms: [],
  status: "",
  minReward: "",
  rewardType: "",
  sort: "newest",
  hideExpired: true,
};

export default function HomePage() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const fetchCampaigns = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.platforms.length > 0) params.set("platform", filters.platforms.join(","));
      if (filters.status) params.set("status", filters.status);
      if (filters.minReward) params.set("minReward", filters.minReward);
      if (filters.rewardType) params.set("rewardType", filters.rewardType);
      if (filters.sort) params.set("sort", filters.sort);
      params.set("hideExpired", filters.hideExpired ? "true" : "false");
      params.set("page", page.toString());
      params.set("pageSize", "12");

      const res = await fetch(`/api/campaigns?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setCampaigns(data.data || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err: any) {
      console.error("Fetch campaigns error:", err);
      setError("Failed to load campaigns. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Debounced search on filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCampaigns(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchCampaigns]);

  const handleResetFilters = () => {
    setFilters(initialFilters);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Banner */}
      <section className="relative rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-10 overflow-hidden shadow-xs">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-3xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Public Vendor Review Incentives Tracker</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
            Find active review rewards from real software vendors.
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Continuously crawls and re-verifies public campaigns offering Amazon gift cards, Visa prepaid cards, and cash rewards on G2, Capterra, TrustRadius, and Gartner Peer Insights.
          </p>
        </div>
      </section>

      {/* Main Content Area: Sidebar + Grid */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Filter Sidebar */}
        <div className="w-full lg:w-72 shrink-0 sticky lg:top-20">
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
            <FilterSidebar
              filters={filters}
              onChange={setFilters}
              onReset={handleResetFilters}
            />
          </div>
        </div>

        {/* Right Campaign Feed */}
        <div className="flex-1 w-full space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/50">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-bold text-foreground">{campaigns.length}</span> of{" "}
              <span className="font-bold text-foreground">{pagination.total}</span> campaigns
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchCampaigns(pagination.page)}
                title="Refresh campaigns"
                className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-primary" : ""}`} />
              </button>

              <div className="flex items-center border border-border rounded-lg overflow-hidden bg-muted/40 p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === "grid" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  aria-label="Table view"
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === "table" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  <TableIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-center gap-3 text-destructive text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Cards or Loading */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <CampaignCardSkeleton key={i} />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            /* Empty State */
            <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center space-y-4 bg-card/50">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">No matching campaigns found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Try adjusting your filters, clearing your search keywords, or selecting more platforms.
                </p>
              </div>
              <button
                onClick={handleResetFilters}
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
              >
                Reset Filters
              </button>
            </div>
          ) : viewMode === "grid" ? (
            /* Card Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {campaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          ) : (
            /* Compact Table View */
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 text-muted-foreground uppercase font-semibold border-b border-border">
                    <tr>
                      <th className="px-4 py-3">Vendor / Product</th>
                      <th className="px-4 py-3">Platform</th>
                      <th className="px-4 py-3">Reward</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-foreground">{c.productName}</div>
                          <div className="text-[11px] text-muted-foreground">{c.vendor.name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-foreground">{c.platform}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            ${c.rewardAmount}
                          </span>{" "}
                          <span className="text-muted-foreground">{c.rewardType}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                              c.status === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : c.status === "LIKELY_ACTIVE"
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-zinc-500/10 text-zinc-500"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={c.directCampaignUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-3 py-1 rounded-md text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            Open
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border/60">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchCampaigns(pagination.page - 1)}
                className="text-xs px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchCampaigns(pagination.page + 1)}
                className="text-xs px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
