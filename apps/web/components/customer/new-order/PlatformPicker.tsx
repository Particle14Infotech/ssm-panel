"use client";

import React from "react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";

interface PlatformPickerProps {
  platforms: string[];
  selectedPlatform: string;
  onSelect: (platform: string) => void;
  counts?: Record<string, number>;
  className?: string;
  showLabels?: boolean;
}

export function PlatformPicker({
  platforms,
  selectedPlatform,
  onSelect,
  counts = {},
  className = "",
  showLabels = false,
}: PlatformPickerProps) {
  // Normalize & deduplicate platforms (e.g. merge X and X_TWITTER)
  const displayPlatforms = React.useMemo(() => {
    const set = new Set<string>();
    const result: Array<{ id: string; name: string; count?: number }> = [];

    const defaultOrder = ["INSTAGRAM", "YOUTUBE", "TIKTOK", "TELEGRAM", "X", "FACEBOOK", "SPOTIFY"];
    
    // First add available platforms matching default order
    for (const p of defaultOrder) {
      const match = platforms.find(
        (raw) => raw.toUpperCase() === p || (p === "X" && raw.toUpperCase() === "X_TWITTER")
      );
      if (match) {
        set.add(p);
        const cnt = counts[p] || counts[p.toLowerCase()] || undefined;
        result.push({
          id: p.toLowerCase(),
          name: p === "X" ? "X" : p.charAt(0) + p.slice(1).toLowerCase(),
          count: cnt,
        });
      }
    }

    // Add any remaining platforms
    for (const raw of platforms) {
      const p = raw.toUpperCase() === "X_TWITTER" ? "X" : raw.toUpperCase();
      if (!set.has(p)) {
        set.add(p);
        const cnt = counts[p] || counts[p.toLowerCase()] || undefined;
        result.push({
          id: p.toLowerCase(),
          name: p === "X" ? "X" : p.charAt(0) + p.slice(1).toLowerCase(),
          count: cnt,
        });
      }
    }

    return result;
  }, [platforms, counts]);

  return (
    <div className={`w-full overflow-x-auto pb-2 scrollbar-none ${className}`}>
      <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-black/40 border border-slate-200/80 dark:border-white/5 backdrop-blur-md inline-flex min-w-full sm:min-w-0 shadow-xs">
        {displayPlatforms.map(({ id, name, count }) => {
          const isSelected = selectedPlatform.toLowerCase() === id.toLowerCase();
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              title={`${name}${count !== undefined ? ` (${count})` : ""}`}
              aria-label={name}
              className={`flex items-center justify-center ${
                showLabels ? "gap-2.5 px-3.5 py-2" : "p-2.5 sm:p-3 min-w-[42px] min-h-[42px]"
              } rounded-xl text-xs font-semibold transition-all duration-200 select-none outline-none focus-visible:ring-2 focus-visible:ring-[#D8EC8D] ${
                isSelected
                  ? "bg-[#D8EC8D] text-[#171e00] font-bold border border-[#b4cf47] shadow-[0_0_15px_rgba(216,236,141,0.35)] dark:bg-accent/15 dark:text-[#D8EC8D] dark:border-[#D8EC8D]/40"
                  : "bg-white dark:bg-white/[0.03] text-slate-700 text-fg-muted border border-slate-200/80 dark:border-transparent hover:bg-slate-50 dark:hover:bg-white/[0.07] hover:text-slate-900 dark:hover:text-white shadow-xs"
              }`}
            >
              <PlatformIcon platform={id} size={20} useBrandColor={isSelected} />
              {showLabels && <span className="capitalize whitespace-nowrap">{name}</span>}
              {showLabels && count !== undefined && count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono leading-none ${
                    isSelected
                      ? "bg-[#171e00]/20 text-[#171e00] dark:bg-[#D8EC8D]/30 dark:text-[#D8EC8D] font-bold"
                      : "bg-slate-200 dark:bg-white/10 text-fg-2"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
