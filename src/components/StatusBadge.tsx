import React from "react";
import { CampaignStatus } from "@/lib/types";
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: CampaignStatus | string;
  confidence?: number;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({
  status,
  confidence,
  className,
  showIcon = true,
}: StatusBadgeProps) {
  let badgeStyle = "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  let label = "Unknown";
  let Icon = HelpCircle;

  switch (status) {
    case "ACTIVE":
      badgeStyle =
        "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
      label = "Active";
      Icon = CheckCircle2;
      break;
    case "LIKELY_ACTIVE":
      badgeStyle =
        "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
      label = "Likely Active";
      Icon = AlertTriangle;
      break;
    case "EXPIRED":
      badgeStyle =
        "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 line-through-none opacity-85";
      label = "Expired";
      Icon = XCircle;
      break;
    default:
      label = status;
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-xs transition-colors",
        badgeStyle,
        className
      )}
      title={confidence !== undefined ? `Confidence: ${Math.round(confidence * 100)}%` : undefined}
    >
      {showIcon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      <span>{label}</span>
      {confidence !== undefined && (
        <span className="opacity-70 text-[10px] ml-0.5">
          {Math.round(confidence * 100)}%
        </span>
      )}
    </span>
  );
}
