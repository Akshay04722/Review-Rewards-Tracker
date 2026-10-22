import React from "react";
import { ShieldAlert, Lock, CheckSquare } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-border/80 bg-background/50 mt-16 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Compliance and Safety Disclaimer Box */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 flex items-start gap-3.5">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
            <h4 className="font-semibold text-foreground text-sm">
              Community Disclaimer & Guidelines
            </h4>
            <p>
              Rewards are offered by vendors, not by this site. Only review products you actually use, write an honest review, and tick the incentive disclosure box on the review platform. Offers can end anytime.
            </p>
            <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-muted-foreground/80">
              <span className="flex items-center gap-1">
                <CheckSquare className="w-3.5 h-3.5 text-primary" />
                Never write fake or incentivized dishonest reviews
              </span>
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                No login required &bull; Privacy-first
              </span>
            </div>
          </div>
        </div>

        {/* Footer bottom metadata */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-3 pt-2">
          <p>&copy; {new Date().getFullYear()} ReviewRewards Tracker. Open source public campaign crawler.</p>
          <div className="flex items-center gap-4">
            <span>Only crawls public pages &bull; Complies with robots.txt</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
