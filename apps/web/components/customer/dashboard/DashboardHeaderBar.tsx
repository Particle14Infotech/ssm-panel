"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import {
  Link as LinkIcon,
  ArrowRight,
  Zap,
  Layers,
  Bot,
  X,
  ShieldCheck,
} from "lucide-react";
import { LinkPreviewCard } from "@/components/shared/LinkPreviewCard";
import { PlatformIcon } from "@/components/shared/PlatformIcon";

export function DashboardHeaderBar() {
  const { user } = useCustomer();
  const router = useRouter();
  const [targetLink, setTargetLink] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const firstName =
    user?.name && user.name.trim() !== "New Customer" && user.name.trim() !== ""
      ? user.name.split(" ")[0]
      : "Customer";

  const detectedPlatform = useMemo(() => {
    if (!targetLink) return null;
    const lower = targetLink.toLowerCase().trim();
    if (lower.includes("instagram.com")) return "instagram";
    if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
    if (lower.includes("tiktok.com")) return "tiktok";
    if (lower.includes("t.me/") || lower.includes("telegram.me/")) return "telegram";
    if (lower.includes("twitter.com") || lower.includes("x.com")) return "x";
    return null;
  }, [targetLink]);

  const isValidUrl = useMemo(() => {
    const trimmed = targetLink.trim();
    return (
      (trimmed.startsWith("http://") || trimmed.startsWith("https://")) &&
      trimmed.includes(".") &&
      trimmed.length > 10
    );
  }, [targetLink]);

  const handleNavigate = (tab: "single" | "combos" | "autopilot", autoSuggest: boolean = true) => {
    if (!targetLink.trim()) return;
    const cleanUrl = targetLink.trim();
    const platQuery = detectedPlatform ? `&platform=${detectedPlatform}` : "";
    router.push(
      `/new-order?target=${encodeURIComponent(cleanUrl)}&tab=${tab}&autoSuggest=${autoSuggest}${platQuery}`
    );
  };

  const handleBoostClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLink.trim()) return;
    if (isValidUrl) {
      setShowSuggestions(true);
    } else {
      handleNavigate("single", true);
    }
  };

  return (
    <div className="space-y-3 pt-1 pb-2">
      {/* Top Greeting & Compact Side Link Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Greeting */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-fg tracking-tight font-sans transition-colors">
            Welcome, {firstName}
          </h1>
          <p className="text-xs text-slate-600 dark:text-fg-muted mt-0.5 font-medium">
            Monitor your active campaigns, execution ledgers, and delivery cadence.
          </p>
        </div>

        {/* Right: Compact Side Quick Link Input (Side placement matching user request) */}
        <form
          onSubmit={handleBoostClick}
          className="relative flex items-center w-full lg:max-w-md bg-slate-100/90 dark:bg-surface-raised border border-slate-300/80 dark:border-border focus-within:border-[#4D6010] dark:focus-within:border-accent rounded-2xl p-1 pr-1.5 transition-all shadow-xs"
        >
          <div className="pl-3 pr-2 text-slate-500 dark:text-fg-muted flex items-center shrink-0">
            {detectedPlatform ? (
              <PlatformIcon platform={detectedPlatform} size={15} />
            ) : (
              <LinkIcon className="w-3.5 h-3.5" />
            )}
          </div>
          <input
            type="text"
            value={targetLink}
            onChange={(e) => {
              setTargetLink(e.target.value);
              if (!e.target.value.trim()) setShowSuggestions(false);
            }}
            placeholder="Paste target link to boost..."
            className="w-full bg-transparent text-slate-900 dark:text-fg text-xs placeholder:text-slate-500 dark:placeholder:text-fg-muted focus:outline-none font-mono py-1 font-medium"
          />
          {targetLink && (
            <button
              type="button"
              onClick={() => {
                setTargetLink("");
                setShowSuggestions(false);
              }}
              className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-md text-slate-500 dark:text-fg-muted hover:text-slate-900 dark:hover:text-fg transition-colors mr-1 cursor-pointer"
              aria-label="Clear link"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            type="submit"
            disabled={!targetLink.trim()}
            className="px-3.5 py-1.5 rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-xs disabled:opacity-40"
          >
            <Zap className="w-3 h-3" />
            <span>Boost Link</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </form>
      </div>

      {/* On-Demand Suggestions & Live Thumbnail Panel (Shown when Boost Link is clicked) */}
      {showSuggestions && isValidUrl && (
        <div className="rounded-2xl bg-surface border border-accent/40 p-4 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2 transition-all">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold text-fg">
                Target Link Insights & Growth Suggestions
              </span>
              {detectedPlatform && (
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-accent/15 text-accent-text border border-accent/20">
                  {detectedPlatform}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowSuggestions(false)}
              className="p-1 hover:bg-white/10 rounded-lg text-fg-muted hover:text-fg transition-colors cursor-pointer"
              aria-label="Close suggestions"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Live Thumbnail Extractor */}
          <LinkPreviewCard
            url={targetLink.trim()}
            selectedPlatform={detectedPlatform || undefined}
          />

          {/* Action Pathways: Best Service / Combo / Auto-Pilot / Skip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleNavigate("single", true)}
              className="p-2.5 rounded-xl bg-accent text-on-accent font-bold text-xs flex items-center justify-center gap-1.5 hover:brightness-105 transition-all shadow-xs cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Best Service</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigate("combos", true)}
              className="p-2.5 rounded-xl bg-surface-raised border border-border hover:border-accent/50 text-fg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-accent-text" />
              <span>Combo Pack</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigate("autopilot", true)}
              className="p-2.5 rounded-xl bg-surface-raised border border-border hover:border-accent/50 text-fg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-accent-text" />
              <span>Auto-Pilot</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigate("single", false)}
              className="p-2.5 rounded-xl bg-surface-raised border border-border hover:border-accent/50 text-fg-muted hover:text-fg font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Skip (Manual)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
