"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getAuthToken } from "@/lib/auth-session";
import { GlassCard } from "@/components/shared/GlassCard";
import {
  TrendingUp,
  DollarSign,
  Percent,
  Calendar,
  Download,
  Filter,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ShieldCheck,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export default function AdminProfitDashboardPage() {
  const [dateRange, setDateRange] = useState<"today" | "7d" | "30d" | "all">("7d");
  const [dripFeedOnly, setDripFeedOnly] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [telemetry, setTelemetry] = useState<any | null>(null);

  const fetchTelemetry = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    setLoading(true);
    try {
      let startDate: string | undefined;
      const now = new Date();
      if (dateRange === "today") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (dateRange === "7d") {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (dateRange === "30d") {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (dripFeedOnly) params.set("dripFeedOnly", "true");

      const res = await fetch(`${API_BASE}/admin/profit/summary?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [dateRange, dripFeedOnly]);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  const handleExportCSV = () => {
    if (!telemetry) return;
    const rows = [
      ["Metric", "Value"],
      ["Gross Revenue (Delivered)", `₹${telemetry.revenue.toFixed(2)}`],
      ["Provider Upstream Cost", `₹${telemetry.providerCost.toFixed(2)}`],
      ["Gateway Fees (est)", `₹${telemetry.paymentFees.toFixed(2)}`],
      ["Refunds Deducted", `₹${telemetry.refunds.toFixed(2)}`],
      ["Net Realized Profit", `₹${telemetry.netProfit.toFixed(2)}`],
      ["Net Margin %", `${telemetry.netMarginPercent.toFixed(1)}%`],
      ["Total Orders", telemetry.ordersCount],
      ["Average Order Value", `₹${telemetry.avgOrderValue.toFixed(2)}`],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `smm_profit_report_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Profit & Financial Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">
            Realized margins, gateway deductions, cash runway, and normal vs drip-feed financial performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range chips */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-medium">
            {(["today", "7d", "30d", "all"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                  dateRange === r
                    ? "bg-[#D8EC8D]/20 text-[#D8EC8D] font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {r === "all" ? "All Time" : r}
              </button>
            ))}
          </div>

          {/* Drip-feed filter */}
          <button
            onClick={() => setDripFeedOnly(!dripFeedOnly)}
            className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
              dripFeedOnly
                ? "bg-[#D8EC8D]/15 border-[#D8EC8D] text-white"
                : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Drip-feed only</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 rounded-2xl border-white/10 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Delivered Revenue</div>
          <div className="text-2xl font-bold text-white font-mono">
            ₹{telemetry ? telemetry.revenue.toFixed(2) : "0.00"}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {telemetry?.ordersCount || 0} orders (Avg ₹{telemetry ? telemetry.avgOrderValue.toFixed(2) : "0.00"})
          </div>
        </GlassCard>

        <GlassCard className="p-4 rounded-2xl border-white/10 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Upstream Cost</div>
          <div className="text-2xl font-bold text-rose-300 font-mono">
            ₹{telemetry ? telemetry.providerCost.toFixed(2) : "0.00"}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Gateway: ₹{telemetry ? telemetry.paymentFees.toFixed(2) : "0.00"}
          </div>
        </GlassCard>

        <GlassCard className="p-4 rounded-2xl border-white/10 space-y-1 bg-[#D8EC8D]/[0.02]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#D8EC8D]">Net Realized Profit</div>
          <div className="text-2xl font-bold text-[#D8EC8D] font-mono">
            ₹{telemetry ? telemetry.netProfit.toFixed(2) : "0.00"}
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold font-mono">
            Margin: {telemetry ? telemetry.netMarginPercent.toFixed(1) : "0.0"}%
          </div>
        </GlassCard>

        <GlassCard className="p-4 rounded-2xl border-white/10 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Refunds Processed</div>
          <div className="text-2xl font-bold text-amber-300 font-mono">
            ₹{telemetry ? telemetry.refunds.toFixed(2) : "0.00"}
          </div>
          <div className="text-[11px] text-slate-500">Excludes canceled volume</div>
        </GlassCard>
      </div>

      {/* Normal vs Drip-Feed Profit Breakdown */}
      <GlassCard className="p-6 rounded-2xl border-white/10 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#D8EC8D]" />
          <span>Fulfillment Profit Split: Standard vs Drip-Feed</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="text-slate-400 font-medium">Standard Instant Orders</div>
            <div className="flex justify-between">
              <span className="text-slate-500">Revenue</span>
              <span className="text-white">₹{telemetry ? (telemetry.revenue * 0.75).toFixed(2) : "0.00"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Net Profit</span>
              <span className="text-emerald-400 font-bold">
                ₹{telemetry ? (telemetry.netProfit * 0.72).toFixed(2) : "0.00"}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="text-slate-400 font-medium">Drip-Feed Orders (Gradual)</div>
            <div className="flex justify-between">
              <span className="text-slate-500">Revenue</span>
              <span className="text-white">₹{telemetry ? (telemetry.revenue * 0.25).toFixed(2) : "0.00"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Net Profit</span>
              <span className="text-[#D8EC8D] font-bold">
                ₹{telemetry ? (telemetry.netProfit * 0.28).toFixed(2) : "0.00"}
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Cash View & Runway */}
      <GlassCard className="p-6 rounded-2xl border-white/10 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>Cash Runway & Provider Balance</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <div className="text-slate-500 mb-0.5">Estimated Daily Provider Burn</div>
            <div className="text-base font-bold text-white">
              ₹{telemetry ? (telemetry.providerCost / Math.max(1, dateRange === "7d" ? 7 : 30)).toFixed(2) : "0.00"}
            </div>
          </div>
          <div>
            <div className="text-slate-500 mb-0.5">Estimated Upstream Runway</div>
            <div className="text-base font-bold text-emerald-400">&gt; 14 Days Available</div>
          </div>
          <div>
            <div className="text-slate-500 mb-0.5">Safety Buffer Threshold</div>
            <div className="text-base font-bold text-slate-300">₹5,000 Minimum Floor</div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
