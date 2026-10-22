"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Moon, Sun, ShieldCheck, Activity } from "lucide-react";

export function Header() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial dark mode from DOM or media query
    if (
      localStorage.theme === "dark" ||
      (!("theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.theme = "light";
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.theme = "dark";
      setIsDark(true);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-white shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
              ReviewRewards
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary ml-1.5 px-1.5 py-0.5 rounded-sm bg-primary/10">
              Tracker
            </span>
          </div>
        </Link>

        {/* Right navigation items */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full border border-border">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Crawler Active (24h Re-verify)</span>
          </div>

          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Admin</span>
          </Link>

          <button
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
            className="p-2 rounded-lg border border-border hover:bg-accent text-foreground transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>
    </header>
  );
}
