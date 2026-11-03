"use client";

import React, { useState } from "react";
import { GlowingFluidOrb } from "./GlowingFluidOrb";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Pause, Play, RefreshCw, CheckCircle2, ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  isPaused?: boolean;
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

      {/* 3-Column Glass Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
        {items.map((item, idx) => {
          const variant = (idx === 0 ? 1 : idx === 1 ? 2 : 3) as 1 | 2 | 3;
          const destinationUrl = item.isPackage || item.id.startsWith("pkg_")
            ? `/packages/${item.id}`
            : `/orders/${item.id}`;

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
              className="p-4 sm:p-5 rounded-2xl bg-surface border border-border hover:border-border-control transition-all duration-300 shadow-sm relative overflow-hidden flex flex-col justify-between space-y-3.5 group cursor-pointer hover:-translate-y-0.5"
            >
              {/* Top-Right Glowing 3D Amorphous Fluid Orb Graphic */}
              <div className="absolute top-2 right-2 z-0 opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none">
                <GlowingFluidOrb size={100} delay={idx * 1.5} variant={variant} />
              </div>

              {/* Card Header & Title */}
              <div className="relative z-10 space-y-1 pr-16">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={item.platform} size={15} useBrandColor={true} />
                  <h3 className="text-sm font-bold text-fg font-sans truncate transition-colors group-hover:text-[#556910] dark:group-hover:text-[#d8ec8d]">
                    {item.title}
                  </h3>
                </div>

                {/* Clickable Order Reference */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-[#556910] dark:text-[#d8ec8d] bg-[#d8ec8d]/20 dark:bg-accent/10 px-2 py-0.5 rounded-md border border-[#b4cf47]/40 dark:border-[#d8ec8d]/30">
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

              {/* Progress Bar & Quantities */}
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
