import React from "react";
import { PlatformType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PlatformBadgeProps {
  platform: PlatformType | string;
  className?: string;
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  let style = "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  let display = platform;

  switch (platform) {
    case "G2":
      style = "bg-orange-500/10 text-orange-600 border border-orange-500/20 dark:bg-orange-950/40 dark:text-orange-400";
      display = "G2";
      break;
    case "Capterra":
      style = "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 dark:bg-indigo-950/40 dark:text-indigo-400";
      display = "Capterra";
      break;
    case "TrustRadius":
      style = "bg-sky-500/10 text-sky-600 border border-sky-500/20 dark:bg-sky-950/40 dark:text-sky-400";
      display = "TrustRadius";
      break;
    case "GartnerPeerInsights":
      style = "bg-purple-500/10 text-purple-600 border border-purple-500/20 dark:bg-purple-950/40 dark:text-purple-400";
      display = "Gartner Peer Insights";
      break;
    case "SoftwareAdvice":
      style = "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-950/40 dark:text-amber-400";
      display = "Software Advice";
      break;
    case "GetApp":
      style = "bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-950/40 dark:text-blue-400";
      display = "GetApp";
      break;
    case "Trustpilot":
      style = "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-400";
      display = "Trustpilot";
      break;
    default:
      display = platform || "Review Platform";
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold tracking-wide",
        style,
        className
      )}
    >
      {display}
    </span>
  );
}
