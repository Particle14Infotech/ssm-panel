"use client";

import React from "react";
import { CountUpNumber } from "@/components/motion/CountUpNumber";
import { ShieldCheck } from "lucide-react";

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
  fulfillmentRate = 98.5,
}: DashboardKpiGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
      {/* 1. Total Orders */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border hover:border-border-control transition-all shadow-sm flex flex-col justify-between space-y-2">
        <div className="text-xs font-medium text-fg-muted font-sans">
          Total Orders
        </div>
        <div className="text-3xl sm:text-4xl font-extrabold text-fg font-sans tracking-tight tabular-nums transition-colors">
          <CountUpNumber value={totalOrders} duration={1.2} />
        </div>
      </div>

      {/* 2. In Progress (Active Drips) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border hover:border-border-control transition-all shadow-sm flex flex-col justify-between space-y-2">
        <div className="text-xs font-medium text-fg-muted font-sans">
          In Progress (Active Drips)
        </div>
        <div className="text-3xl sm:text-4xl font-extrabold text-fg font-sans tracking-tight tabular-nums transition-colors">
          <CountUpNumber value={inProgressCount} duration={1.2} />
        </div>
      </div>

      {/* 3. Completed Orders */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border hover:border-border-control transition-all shadow-sm flex flex-col justify-between space-y-2">
        <div className="text-xs font-medium text-fg-muted font-sans">
          Completed Orders
        </div>
        <div className="text-3xl sm:text-4xl font-extrabold text-fg font-sans tracking-tight tabular-nums transition-colors">
          <CountUpNumber value={completedCount} duration={1.2} />
        </div>
      </div>

      {/* 4. Delivery Health & Compliance (Delivery Health card) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border hover:border-border-control transition-all shadow-sm flex flex-col justify-between space-y-2 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-medium text-fg-muted font-sans">
          <span>Delivery Health &amp; Compliance</span>
          <div className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-success flex items-center justify-center">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-extrabold text-fg font-sans tracking-tight tabular-nums transition-colors">
            {fulfillmentRate.toFixed(1)}%
          </span>
          <span className="text-xs font-bold text-emerald-700 dark:text-success font-sans px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
            Optimal
          </span>
        </div>
      </div>
    </div>
  );
}
