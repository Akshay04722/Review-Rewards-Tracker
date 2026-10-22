"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Play,
  RotateCw,
  AlertTriangle,
  Clock,
  Key,
  TrendingDown,
  FilterX,
  ExternalLink,
} from "lucide-react";

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState<any | null>(null);
  const [crawlRuns, setCrawlRuns] = useState<any[]>([]);
  const [topRejections, setTopRejections] = useState<any[]>([]);
  const [lowestConfidenceCampaigns, setLowestConfidenceCampaigns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("admin_token") || "";
    if (savedToken) {
      setToken(savedToken);
      fetchAdminData(savedToken);
    }
  }, []);

  const fetchAdminData = async (authToken: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/crawl", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false);
          throw new Error("Invalid admin token");
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setStats(data.stats);
      setCrawlRuns(data.crawlRuns || []);
      setTopRejections(data.topRejections || []);
      setLowestConfidenceCampaigns(data.lowestConfidenceCampaigns || []);
      setIsAuthenticated(true);
      localStorage.setItem("admin_token", authToken);
    } catch (err: any) {
      setError(err.message || "Authentication error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAdminData(token);
  };

  const handleTriggerCrawl = async () => {
    setIsCrawling(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/crawl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ trigger: "MANUAL", async: false }),
      });

      if (!res.ok) throw new Error("Crawl failed to execute");

      const result = await res.json();
      const r = result.result;
      alert(
        `Crawl finished!\nSearches: ${r?.searchesUsed || 0}\nCandidates: ${r?.totalCandidates || 0}\nDropped: ${
          r?.droppedCount || 0
        }\nRejected: ${r?.rejectedCount || 0}\nSaved: ${r?.savedCount || 0}`
      );
      fetchAdminData(token);
    } catch (err: any) {
      setError(err.message || "Failed to trigger crawl");
    } finally {
      setIsCrawling(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-md space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Key className="w-6 h-6" />
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-foreground">Admin Authentication</h1>
            <p className="text-xs text-muted-foreground">
              Provide the configured ADMIN_TOKEN to access crawl observability and rule tuning.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground">Admin Security Token</label>
              <input
                type="password"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter ADMIN_TOKEN"
                className="w-full mt-1.5 px-3 py-2 text-sm bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary/40 focus:outline-hidden"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
            >
              {isLoading ? "Verifying..." : "Access Admin Console"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner & Trigger Crawl Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              Crawler Observability & Rule Tuning
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Monitor pipeline accuracy metrics, top candidate rejection reasons, and low-confidence pages.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchAdminData(token)}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-border hover:bg-muted text-muted-foreground transition-colors"
            title="Refresh metrics"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleTriggerCrawl}
            disabled={isCrawling}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isCrawling ? "animate-spin" : ""}`} />
            <span>{isCrawling ? "Executing Crawl..." : "Trigger Manual Crawl"}</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
            <div className="text-xs text-muted-foreground font-medium">Total Listings</div>
            <div className="text-2xl font-black text-foreground">{stats.totalCampaigns}</div>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-1">
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Active</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.activeCampaigns}</div>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-1">
            <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">Likely Active</div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {stats.likelyActiveCampaigns || 0}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-500/20 bg-zinc-500/5 p-5 space-y-1">
            <div className="text-xs text-zinc-500 font-medium">Expired</div>
            <div className="text-2xl font-black text-zinc-500">{stats.expiredCampaigns}</div>
          </div>
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 space-y-1">
            <div className="text-xs text-destructive font-medium">Rejected URLs (7d)</div>
            <div className="text-2xl font-black text-destructive">{stats.totalRejectedUrls}</div>
          </div>
        </div>
      )}

      {/* Observability: Top Rejection Reasons & Lowest Confidence Listings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Rejection Reasons */}
        <div className="rounded-3xl border border-border bg-card p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FilterX className="w-4 h-4 text-destructive" />
              <span>Top Candidate Rejection Reasons</span>
            </h2>
            <span className="text-[10px] text-muted-foreground font-mono">Last 200 Rejections</span>
          </div>

          {topRejections.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {topRejections.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20 text-xs"
                >
                  <span className="text-foreground font-medium truncate max-w-[80%]">{item.reason}</span>
                  <span className="px-2 py-0.5 rounded-full font-bold bg-destructive/10 text-destructive text-[11px]">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4">No rejected candidates recorded yet.</p>
          )}
        </div>

        {/* Lowest Confidence Listings */}
        <div className="rounded-3xl border border-border bg-card p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-amber-500" />
              <span>Lowest Confidence Listings (Rule Tuning)</span>
            </h2>
            <span className="text-[10px] text-muted-foreground font-mono">Bottom 10</span>
          </div>

          {lowestConfidenceCampaigns.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {lowestConfidenceCampaigns.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl border border-border/60 bg-muted/20 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground truncate max-w-[70%]">
                      {c.productName} ({c.vendor?.name})
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600">
                      {(c.confidence * 100).toFixed(0)}% conf
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{c.statusReason || "No status reason"}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-primary font-semibold">{c.platform}</span>
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <span>Inspect</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4">No campaign listings tracked yet.</p>
          )}
        </div>
      </div>

      {/* Crawl Runs History Table */}
      <div className="rounded-3xl border border-border bg-card p-6 space-y-4 shadow-xs">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span>Crawl Execution Summaries</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground uppercase font-semibold border-b border-border">
              <tr>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Searches</th>
                <th className="px-4 py-3">Candidates</th>
                <th className="px-4 py-3">Dropped</th>
                <th className="px-4 py-3">Rejected</th>
                <th className="px-4 py-3">Saved</th>
                <th className="px-4 py-3">Status Counts</th>
                <th className="px-4 py-3">Started At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {crawlRuns.map((run) => {
                let statusCountsObj: Record<string, number> = {};
                try {
                  if (run.statusCounts) statusCountsObj = JSON.parse(run.statusCounts);
                } catch {}

                return (
                  <tr key={run.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{run.trigger}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          run.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : run.status === "RUNNING"
                            ? "bg-amber-500/10 text-amber-600 animate-pulse"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{run.searchesUsed || 0}</td>
                    <td className="px-4 py-3 font-mono">{run.totalCandidates}</td>
                    <td className="px-4 py-3 text-destructive font-mono">{run.droppedCount || 0}</td>
                    <td className="px-4 py-3 text-amber-600 font-mono">{run.rejectedCount || 0}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                      {run.savedCount || run.verifiedCount || 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-[10px]">
                        {Object.entries(statusCountsObj).map(([st, cnt]) => (
                          <span key={st} className="px-1.5 py-0.5 rounded bg-muted font-medium">
                            {st}: {cnt}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(run.startedAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
