"use client";

import React, { useMemo } from "react";
import { getRecommendedServicesForTarget, RecommendationResult } from "@/lib/service-recommendation";
import { Sparkles, Check, ArrowRight, Zap, Flame, ShieldCheck } from "lucide-react";

interface SmartServiceSuggestionsProps {
  targetUrl: string;
  services: any[];
  selectedServiceId?: string;
  onSelectService: (service: any) => void;
  className?: string;
}

export function SmartServiceSuggestions({
  targetUrl,
  services = [],
  selectedServiceId,
  onSelectService,
  className = "",
}: SmartServiceSuggestionsProps) {
  const result = useMemo<RecommendationResult | null>(() => {
    return getRecommendedServicesForTarget(targetUrl, services);
  }, [targetUrl, services]);

  if (!result || result.recommendations.length === 0) {
    return null;
  }

  const formatKindLabel = (kind: string, platform: string) => {
    const p = platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
    const k = kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase();
    return `${p} ${k}`;
  };

  return (
    <div
      className={`rounded-2xl bg-surface/90 border border-accent/30 p-3 sm:p-4 space-y-3 backdrop-blur-md shadow-sm animate-in fade-in slide-in-from-top-2 transition-all ${className}`}
    >
      {/* Header with Detected Kind Pill */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent-text">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 flex-wrap">
              <span>Smart Recommendations for this</span>
              <span className="font-mono text-accent-text bg-accent/15 px-2 py-0.5 rounded-md border border-accent/20">
                {formatKindLabel(result.detectedKind, result.detectedPlatform)}
              </span>
            </h4>
            <p className="text-[10px] text-fg-muted">
              Auto-selected algorithmically for highest retention, instant start, and zero drop.
            </p>
          </div>
        </div>
      </div>

      {/* 3 Actionable Service Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {result.recommendations.map((rec) => {
          const isSelected = selectedServiceId === rec.service.id;
          const rateNum = Number(rec.service.ratePer1000 || rec.service.rate || 0);

          return (
            <div
              key={rec.service.id}
              onClick={() => onSelectService(rec.service)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 group ${
                isSelected
                  ? "bg-accent/15 border-accent ring-1 ring-accent/50 shadow-[0_0_15px_rgba(216,236,141,0.2)]"
                  : "bg-surface-raised border-border hover:border-accent/40 hover:bg-surface"
              }`}
            >
              <div className="space-y-1.5">
                {/* Badge Label */}
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border uppercase tracking-wider ${rec.badgeColor}`}
                  >
                    {rec.badgeLabel}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-accent-text">
                    ₹{rateNum.toFixed(2)}/1k
                  </span>
                </div>

                {/* Service Name */}
                <div
                  className={`text-xs font-semibold leading-tight line-clamp-2 transition-colors ${
                    isSelected ? "text-accent-text font-bold" : "text-fg group-hover:text-accent-text"
                  }`}
                  title={rec.service.displayName || rec.service.name}
                >
                  {rec.service.displayName || rec.service.name}
                </div>

                {/* Algorithmic Reason */}
                <div className="text-[10px] text-fg-muted font-sans flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="truncate">{rec.reason}</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectService(rec.service);
                }}
                className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-accent text-on-accent shadow-xs"
                    : "bg-surface text-fg-2 hover:bg-accent hover:text-on-accent border border-border"
                }`}
              >
                {isSelected ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Selected</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3 h-3 text-accent-text group-hover:text-on-accent" />
                    <span>Select Service</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

