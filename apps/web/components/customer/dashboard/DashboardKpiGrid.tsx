"use client";

import React from "react";
import { CountUpNumber } from "@/components/motion/CountUpNumber";
import { ShieldCheck, Layers, Clock, CheckCircle2 } from "lucide-react";

interface DashboardKpiGridProps {
  totalOrders: number;
  inProgressCount: number;
  completedCount: number;
  fulfillmentRate?: number;
}

export function DashboardKpiGrid({
  totalOrders,
  inProgressCount,
  completedCount,
  fulfillmentRate = 100,
}: DashboardKpiGridProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-b from-white to-slate-50/80 dark:from-transparent dark:to-transparent dark:bg-surface border border-slate-200/90 dark:border-border p-3 sm:p-4 shadow-xs transition-colors space-y-2.5">
      {/* Top Prominent Row: Fulfillment Rate */}
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-border pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4 text-[#4D6010] dark:text-accent-text" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-600 dark:text-fg-muted block font-semibold">
              Fulfillment Rate
            </span>
            <span className="text-base sm:text-lg font-bold text-[#4D6010] dark:text-accent-text font-mono tabular-nums leading-tight">
              {fulfillmentRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Total Orders counter */}
        <div className="flex items-center gap-2 bg-slate-100/90 dark:bg-surface-raised border border-slate-200/90 dark:border-border px-3 py-1.5 rounded-xl">
          <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-fg-muted" />
          <div className="flex items-baseline gap-1.5 font-mono">
            <span className="text-[10px] uppercase text-slate-600 dark:text-fg-muted font-bold">Total:</span>
            <span className="text-sm font-bold text-slate-900 dark:text-fg tabular-nums">
              <CountUpNumber value={totalOrders} duration={0.8} />
            </span>
          </div>
        </div>
      </div>

      {/* Subline Row: In Progress & Completed Status */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        {/* In Progress */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-1.5 text-amber-500">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">In Progress:</span>
          </div>
          <span className="text-sm font-bold text-amber-500 tabular-nums">
            <CountUpNumber value={inProgressCount} duration={0.8} />
          </span>
        </div>

        {/* Completed */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-1.5 text-emerald-500">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Completed:</span>
          </div>
          <span className="text-sm font-bold text-emerald-500 tabular-nums">
            <CountUpNumber value={completedCount} duration={0.8} />
          </span>
        </div>
      </div>
    </div>
  );
}
