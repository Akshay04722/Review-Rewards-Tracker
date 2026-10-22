import React from "react";
import { RewardType } from "@/lib/types";
import { Gift, CreditCard, Utensils, DollarSign, Heart, Sparkles } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

interface RewardBadgeProps {
  amount: number;
  currency?: string;
  rewardType: RewardType | string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function RewardBadge({
  amount,
  currency = "USD",
  rewardType,
  className,
  size = "md",
}: RewardBadgeProps) {
  let Icon = Gift;
  switch (rewardType) {
    case "Amazon":
      Icon = Gift;
      break;
    case "Visa":
      Icon = CreditCard;
      break;
    case "UberEats":
      Icon = Utensils;
      break;
    case "Cash":
      Icon = DollarSign;
      break;
    case "Donation":
      Icon = Heart;
      break;
    default:
      Icon = Sparkles;
      break;
  }

  const formattedAmount = amount > 0 ? formatCurrency(amount, currency) : "Incentive";

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-2.5 py-1 gap-1.5",
    lg: "text-base px-3.5 py-1.5 gap-2 font-bold",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 font-semibold border border-emerald-500/30",
        sizeClasses[size],
        className
      )}
    >
      <Icon className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span>{formattedAmount}</span>
      <span className="opacity-80 text-xs font-normal">
        {rewardType !== "Other" ? rewardType : ""}
      </span>
    </div>
  );
}
