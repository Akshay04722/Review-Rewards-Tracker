"use client";

import React from "react";
import {
  Filter,
  RotateCcw,
  Search,
  DollarSign,
  Layers,
  Tag,
} from "lucide-react";
import { PlatformList, RewardTypeList, CampaignStatusList } from "@/lib/types";

export interface FilterState {
  q: string;
  platforms: string[];
  status: string;
  minReward: string;
  rewardType: string;
  sort: string;
  hideExpired: boolean;
}

interface FilterSidebarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
}

export function FilterSidebar({
  filters,
  onChange,
  onReset,
}: FilterSidebarProps) {
  const togglePlatform = (platform: string) => {
    const nextPlatforms = filters.platforms.includes(platform)
      ? filters.platforms.filter((p) => p !== platform)
      : [...filters.platforms, platform];
    onChange({ ...filters, platforms: nextPlatforms });
  };

  const handleStatusChange = (status: string) => {
    onChange({
      ...filters,
      status: filters.status === status ? "" : status,
    });
  };

  return (
    <aside className="w-full space-y-6">
      {/* Top Header & Reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <Filter className="w-4 h-4 text-primary" />
          <span>Filters</span>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset all</span>
        </button>
      </div>

      {/* Hide Expired Toggle (ON by default) */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-border/80 bg-muted/20">
        <label htmlFor="hide-expired-toggle" className="text-xs font-semibold text-foreground cursor-pointer select-none">
          Hide Expired
        </label>
        <input
          id="hide-expired-toggle"
          type="checkbox"
          checked={filters.hideExpired}
          onChange={(e) => onChange({ ...filters, hideExpired: e.target.checked })}
          className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
        />
      </div>

      {/* Search Input */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Search
        </label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search vendor, product..."
            value={filters.q}
            onChange={(e) => onChange({ ...filters, q: e.target.value })}
            className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-input rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Sort Select */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sort By
        </label>
        <select
          value={filters.sort}
          onChange={(e) => onChange({ ...filters, sort: e.target.value })}
          className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-foreground"
        >
          <option value="newest">Newest First</option>
          <option value="reward-desc">Highest Reward ($)</option>
          <option value="reward-asc">Lowest Reward ($)</option>
          <option value="deadline">Approaching Deadline</option>
        </select>
      </div>

      {/* Status Filter */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Status
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: "", label: "All" },
            { value: "ACTIVE", label: "Active" },
            { value: "LIKELY_ACTIVE", label: "Likely Active" },
            { value: "EXPIRED", label: "Expired" },
          ].map((item) => {
            const isSelected = filters.status === item.value;
            return (
              <button
                key={item.value}
                onClick={() => handleStatusChange(item.value)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Platform Filter (Multi-select) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Platforms</span>
          </label>
          {filters.platforms.length > 0 && (
            <span className="text-[10px] text-primary font-semibold">
              {filters.platforms.length} selected
            </span>
          )}
        </div>
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {PlatformList.filter((p) => p !== "Other").map((platform) => {
            const isChecked = filters.platforms.includes(platform);
            const labelMap: Record<string, string> = {
              G2: "G2",
              Capterra: "Capterra",
              TrustRadius: "TrustRadius",
              GartnerPeerInsights: "Gartner Peer Insights",
              SoftwareAdvice: "Software Advice",
              GetApp: "GetApp",
              Trustpilot: "Trustpilot",
            };
            return (
              <label
                key={platform}
                className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer hover:bg-muted/50 p-1.5 rounded-lg transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => togglePlatform(platform)}
                  className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <span className="font-medium">
                  {labelMap[platform] || platform}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Minimum Reward Filter */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5" />
          <span>Minimum Reward</span>
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {["", "10", "25", "50"].map((amt) => {
            const isSelected = filters.minReward === amt;
            return (
              <button
                key={amt}
                onClick={() =>
                  onChange({ ...filters, minReward: isSelected ? "" : amt })
                }
                className={`text-xs py-1.5 rounded-lg border font-medium text-center transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {amt ? `$${amt}+` : "Any"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reward Type Filter */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" />
          <span>Reward Type</span>
        </label>
        <select
          value={filters.rewardType}
          onChange={(e) => onChange({ ...filters, rewardType: e.target.value })}
          className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-foreground"
        >
          <option value="">All Reward Types</option>
          {RewardTypeList.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
