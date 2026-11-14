"use client";

import React, { useState } from "react";
import { PackageThumbnail } from "@/components/shared/PackageThumbnail";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Pause, Play, RefreshCw, CheckCircle2, ArrowRight, ArrowUpRight, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatIndianNumber } from "@/lib/numberFormat";

export interface ProcessItem {
  id: string;
  title: string;
  orderRef: string;
  platform: string;
  dayText: string;
  progressPercent: number;
  currentUnits: number;
  targetUnits: number;
  unitLabel: string;
  nextBatchInfo: string;
  isAutoPilot?: boolean;
  isPackage?: boolean;
  quotaUsed?: number;
  quotaTotal?: number;
  targetUrl?: string;
  thumbnailUrl?: string;
  rawPkg?: any;
  isPaused?: boolean;
  startCount?: number;
  endCount?: number;
  currentCount?: number;
  deliveredUnits?: number;
  totalPlannedUnits?: number;
  completedRuns?: number;
  totalRuns?: number;
}

interface ActiveProcessCardsProps {
  processes?: ProcessItem[];
}

export function ActiveProcessCards({ processes: initialProcesses }: ActiveProcessCardsProps) {
  const router = useRouter();
  const [items, setItems] = useState<ProcessItem[]>(() => {
    if (initialProcesses && initialProcesses.length > 0) return initialProcesses;
    return [
      {
        id: "drip-1",
        title: "Instagram Reel Boost",
        orderRef: "#Reel_884",
        platform: "instagram",
        dayText: "Processing • 64% Complete",
        progressPercent: 64,
        currentUnits: 32000,
        targetUnits: 50000,
        unitLabel: "Views",
        nextBatchInfo: "Active provider delivery",
        targetUrl: "https://instagram.com/reel/C0xyz884",
        isPaused: false,
      },
      {
        id: "drip-2",
        title: "YouTube Shorts Drip",
        orderRef: "#Short_412",
        platform: "youtube",
        dayText: "Processing • 42% Complete",
        progressPercent: 42,
        currentUnits: 32000,
        targetUnits: 50000,
        unitLabel: "Views",
        nextBatchInfo: "Active provider delivery",
        targetUrl: "https://youtube.com/shorts/dQw4w9WgXcQ",
        isPaused: false,
      },
      {
        id: "autopilot-1",
        title: "Auto-Pilot Sync Radar",
        orderRef: "@arjun_official",
        platform: "instagram",
        dayText: "Active",
        progressPercent: 46,
        currentUnits: 14,
        targetUnits: 30,
        unitLabel: "Monthly Posts",
        nextBatchInfo: "Monthly Post Quota Used",
        isAutoPilot: true,
        quotaUsed: 14,
        quotaTotal: 30,
        targetUrl: "https://instagram.com/arjun_official",
        isPaused: false,
      },
    ];
  });

  // Keep state synced if initialProcesses updates
  React.useEffect(() => {
    if (initialProcesses && initialProcesses.length > 0) {
      setItems(initialProcesses);
    }
  }, [initialProcesses]);

  const [swapModalItem, setSwapModalItem] = useState<ProcessItem | null>(null);
  const [newTargetUrl, setNewTargetUrl] = useState<string>("");
  const [swapNotice, setSwapNotice] = useState<string | null>(null);

  const togglePause = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isPaused: !item.isPaused } : item
      )
    );
  };

  const handleSwapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapModalItem || !newTargetUrl.trim()) return;

    setItems((prev) =>
      prev.map((item) =>
        item.id === swapModalItem.id
          ? { ...item, targetUrl: newTargetUrl.trim() }
          : item
      )
    );
    setSwapNotice(`Target link updated for ${swapModalItem.orderRef}`);
    setSwapModalItem(null);
    setNewTargetUrl("");
    setTimeout(() => setSwapNotice(null), 3000);
  };

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-bold text-fg tracking-tight font-sans transition-colors">
          Active Link Processes &amp; Delivery Queue
        </h2>
        <Link
          href="/orders"
          className="text-xs text-[#556910] dark:text-[#d8ec8d] hover:underline font-mono flex items-center gap-1 font-semibold"
        >
          <span>View All Active</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {swapNotice && (
        <div className="p-2.5 rounded-xl bg-[#d8ec8d]/15 border border-[#b4cf47] dark:border-[#d8ec8d]/30 text-xs text-slate-900 dark:text-[#d8ec8d] flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#d8ec8d]" />
          <span>{swapNotice}</span>
        </div>
      )}

      {/* Responsive Grid for up to 5 Active Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5">
        {items.map((item, idx) => {
          const destinationUrl = item.isPackage || item.id.startsWith("pkg_")
            ? `/packages/${item.id}`
            : `/orders/${item.id}`;

          // Requirement 11: Extract Instagram account name / handle
          const accountHandle = (() => {
            if (item.rawPkg?.handle && !item.rawPkg.handle.startsWith("http")) {
              return `@${item.rawPkg.handle.replace(/^@/, "")}`;
            }
            if (item.targetUrl) {
              const raw = item.targetUrl.trim();
              if (raw.startsWith("@")) return raw;
              try {
                const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
                const parts = url.pathname.split("/").filter(Boolean);
                if (parts.length >= 1 && !["reel", "reels", "p", "tv", "shorts", "channel"].includes(parts[0])) {
                  return `@${parts[0]}`;
                }
              } catch {}
            }
            if (item.orderRef && item.orderRef.startsWith("@")) {
              return item.orderRef;
            }
            return null;
          })();

          // Sanitize title so raw links are never shown as the card header
          const cleanTitle = (() => {
            if (!item.title) return "Active Dispatch";
            if (
              item.title.startsWith("http://") ||
              item.title.startsWith("https://") ||
              item.title.startsWith("@http://") ||
              item.title.startsWith("@https://")
            ) {
              const raw = item.title.replace(/^@/, "");
              if (raw.includes("/reel/")) return "Instagram Reel";
              if (raw.includes("/p/")) return "Instagram Post";
              if (raw.includes("/shorts/")) return "YouTube Short";
              if (raw.includes("/watch") || raw.includes("youtu.be")) return "YouTube Video";
              if (raw.includes("t.me/")) return "Telegram Channel";
              return "Growth Dispatch";
            }
            return item.title;
          })();

          return (
            <div
              key={item.id}
              onClick={() => {
                if (item.isAutoPilot) {
                  router.push("/new-order?tab=autopilot");
                } else {
                  router.push(destinationUrl);
                }
              }}
              className="p-3 sm:p-3.5 rounded-2xl bg-surface border border-border hover:border-border-control transition-all duration-300 shadow-sm relative overflow-hidden flex flex-col justify-between space-y-2 group cursor-pointer hover:-translate-y-0.5"
            >
              {/* Top-Right Media Thumbnail: Enlarged per Requirement 11 */}
              <div className="absolute top-3 right-3 z-10">
                <PackageThumbnail
                  pkg={
                    item.rawPkg || {
                      id: item.id,
                      platform: item.platform,
                      handle: item.targetUrl,
                      slots: [{ targetUrl: item.targetUrl }],
                    }
                  }
                  size="lg"
                  className="rounded-2xl border border-border shadow-sm group-hover:border-accent/40 transition-colors w-14 h-14 sm:w-16 sm:h-16"
                />
              </div>

              {/* Card Header & Title */}
              <div className="relative z-10 space-y-0.5 pr-16 sm:pr-20">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <PlatformIcon platform={item.platform} size={14} useBrandColor={true} />
                  <h3 className="text-xs sm:text-sm font-bold text-fg font-sans truncate transition-colors group-hover:text-accent-text">
                    {cleanTitle}
                  </h3>
                  {accountHandle && (
                    <span className="text-[11px] font-mono font-bold text-accent-text bg-accent/10 px-1.5 py-0.2 rounded border border-accent/20 truncate max-w-[120px]">
                      {accountHandle}
                    </span>
                  )}
                </div>

                {/* Clickable Order Reference */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-accent-text bg-accent/10 px-2 py-0.5 rounded-md border border-accent/20">
                    <span>{item.orderRef}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-80 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </span>
                </div>

                {/* Status Subline */}
                <div className="flex items-center gap-1.5 pt-1 text-[11px] font-sans">
                  {item.isAutoPilot ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold">
                      Active
                    </span>
                  ) : (
                    <>
                      <span
                        className={`w-2 h-2 rounded-full ${item.isPaused
                            ? "bg-amber-400"
                            : "bg-[#d8ec8d] shadow-[0_0_6px_#d8ec8d] animate-pulse"
                          }`}
                      />
                      <span className={item.isPaused ? "text-amber-600 dark:text-amber-300 font-semibold" : "text-fg-2"}>
                        {item.isPaused ? "Paused" : item.dayText}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Start Count -> Current -> Target End Count Visualizer */}
              {item.startCount !== undefined && item.endCount !== undefined ? (
                <div className="relative z-10 space-y-1.5 pt-1">
                  {/* Start -> Live -> Goal Metric Row */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-fg-2">
                    <span className="bg-surface-raised px-2 py-0.5 rounded border border-border">
                      Start: <strong className="text-fg">{formatIndianNumber(item.startCount)}</strong>
                    </span>
                    <span className="text-accent-text font-bold">
                      Now: {formatIndianNumber(item.currentCount ?? (item.startCount + (item.deliveredUnits ?? item.currentUnits)))}
                    </span>
                    <span className="bg-surface-raised px-2 py-0.5 rounded border border-border">
                      Goal: <strong className="text-fg">{formatIndianNumber(item.endCount)}</strong>
                    </span>
                  </div>

                  {/* Progress Bar Track & Fill */}
                  <div className="w-full bg-slate-100 dark:bg-black/60 h-2 rounded-full overflow-hidden p-0.5 border border-slate-200/80 dark:border-white/5 relative">
                    <div
                      className="bg-gradient-to-r from-accent to-[#BEF264] h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(216,236,141,0.5)]"
                      style={{ width: `${Math.min(100, Math.max(item.progressPercent, 4))}%` }}
                    />
                  </div>

                  {/* Units & Runs Progress Subline */}
                  <div className="flex justify-between items-center text-[10px] font-mono text-fg-muted">
                    <span>
                      {formatIndianNumber(item.deliveredUnits ?? item.currentUnits)} / {formatIndianNumber(item.totalPlannedUnits ?? item.targetUnits)} {item.unitLabel} ({item.progressPercent}%)
                    </span>
                    {item.totalRuns ? (
                      <span className="text-accent-text font-semibold">
                        Batch {item.completedRuns ?? 0}/{item.totalRuns}
                      </span>
                    ) : (
                      <span>{item.nextBatchInfo}</span>
                    )}
                  </div>
                </div>
              ) : (
                /* Fallback Progress Bar & Quantities */
                <div className="relative z-10 space-y-1.5 pt-1">
                  <div className="flex justify-between items-baseline text-xs font-sans">
                    <span className="font-extrabold text-fg tracking-tight transition-colors">
                      {item.isAutoPilot
                        ? `${item.quotaUsed}/${item.quotaTotal}`
                        : `${item.currentUnits.toLocaleString()} / ${item.targetUnits.toLocaleString()} ${item.unitLabel}`}
                    </span>
                    <span className="text-[11px] font-mono text-[#556910] dark:text-[#d8ec8d] font-bold">
                      {item.progressPercent}%
                    </span>
                  </div>

                  {/* Progress Bar Track & Fill */}
                  <div className="w-full bg-slate-100 dark:bg-black/60 h-2 rounded-full overflow-hidden p-0.5 border border-slate-200/80 dark:border-white/5">
                    <div
                      className="bg-[#d8ec8d] h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(216,236,141,0.5)]"
                      style={{ width: `${Math.min(item.progressPercent, 100)}%` }}
                    />
                  </div>

                  {/* Subline Details */}
                  <div className="text-[11px] font-mono text-fg-muted">
                    {item.isAutoPilot
                      ? "Monthly Post Quota Used"
                      : item.nextBatchInfo}
                  </div>
                </div>
              )}

              {/* Bottom Action Buttons */}
              <div
                className="relative z-10 pt-2 flex items-center gap-2 border-t border-slate-100 dark:border-white/[0.06]"
                onClick={(e) => e.stopPropagation()}
              >
                {item.isAutoPilot ? (
                  <Link
                    href="/new-order?tab=autopilot"
                    className="w-full text-center py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/10 dark:text-slate-200 text-xs font-semibold transition-all font-sans"
                  >
                    Manage Radar
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => togglePause(item.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/10 dark:text-slate-200 text-xs font-semibold transition-all font-sans cursor-pointer"
                    >
                      {item.isPaused ? (
                        <>
                          <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-[#d8ec8d]" />
                          <span>Resume</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5 text-fg-muted" />
                          <span>Pause</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSwapModalItem(item);
                        setNewTargetUrl(item.targetUrl || "");
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/10 dark:text-slate-200 text-xs font-semibold transition-all font-sans cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-fg-muted" />
                      <span>Swap Link</span>
                    </button>

                    <Link
                      href={destinationUrl}
                      className="px-2.5 py-1.5 rounded-xl bg-[#d8ec8d]/20 hover:bg-[#d8ec8d]/35 border border-[#b4cf47] dark:border-[#d8ec8d]/40 text-slate-900 dark:text-[#d8ec8d] text-xs font-bold transition-all font-sans flex items-center gap-1 shrink-0"
                    >
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Swap Link Modal */}
      {swapModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131313] border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h4 className="text-sm font-bold text-fg font-sans">
              Swap Destination Link ({swapModalItem.orderRef})
            </h4>
            <p className="text-xs text-fg-muted">
              Provide a new public link for remaining drip batches. Undispatched units will route to this target.
            </p>
            <form onSubmit={handleSwapSubmit} className="space-y-4">
              <input
                type="url"
                required
                value={newTargetUrl}
                onChange={(e) => setNewTargetUrl(e.target.value)}
                placeholder="https://instagram.com/reel/..."
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-black/50 border border-border focus:border-[#b4cf47] dark:focus:border-[#d8ec8d] text-xs text-fg placeholder-slate-400 dark:placeholder-slate-500 font-mono outline-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setSwapModalItem(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-semibold text-fg-2 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-[#d8ec8d] text-[#171e00] text-xs font-bold hover:brightness-105 transition-all shadow-sm cursor-pointer"
                >
                  Confirm Swap
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
