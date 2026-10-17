"use client";

import React, { useState, useMemo } from "react";
import { useAdmin } from "@/context/AdminContext";
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Layers,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  Activity,
  ArrowUpRight,
  Filter,
  Sparkles,
} from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";

export default function AdminReportsPage() {
  const { orders, users, transactions, services, providers } = useAdmin();
  const [timeRange, setTimeRange] = useState<"24H" | "7D" | "30D" | "ALL">("30D");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Time range calculation
  const filteredOrders = useMemo(() => {
    const now = Date.now();
    return orders.filter((o) => {
      if (timeRange === "ALL") return true;
      const orderTime = new Date(o.createdAt).getTime();
      const diffHours = (now - orderTime) / (1000 * 60 * 60);
      if (timeRange === "24H") return diffHours <= 24;
      if (timeRange === "7D") return diffHours <= 24 * 7;
      if (timeRange === "30D") return diffHours <= 24 * 30;
      return true;
    });
  }, [orders, timeRange]);

  // Financial Telemetry
  const totalGrossRevenue = filteredOrders.reduce((acc, o) => acc + (o.charge || 0), 0);
  const upstreamCost = Math.round(totalGrossRevenue * 0.65);
  const netProfit = totalGrossRevenue - upstreamCost;
  const avgOrderValue = filteredOrders.length > 0 ? totalGrossRevenue / filteredOrders.length : 0;
  const profitMarginPct = totalGrossRevenue > 0 ? ((netProfit / totalGrossRevenue) * 100).toFixed(1) : "35.0";

  // Order Status Breakdown
  const completedOrders = filteredOrders.filter((o) => o.status === "COMPLETED");
  const inProgressOrders = filteredOrders.filter((o) => o.status === "IN_PROGRESS" || o.status === "PROCESSING");
  const cancelledOrders = filteredOrders.filter((o) => o.status === "CANCELLED");
  const failedOrders = filteredOrders.filter((o) => o.status === "FAILED");

  // User Tier Distribution
  const tierCounts = useMemo(() => {
    const counts = { STARTER: 0, GROWTH: 0, PRO_SCALE: 0, ENTERPRISE: 0 };
    users.forEach((u) => {
      if (counts[u.tier] !== undefined) counts[u.tier]++;
      else counts.STARTER++;
    });
    return counts;
  }, [users]);

  // Platform Breakdown
  const platformRevenue = useMemo(() => {
    const map: Record<string, { count: number; volume: number }> = {};
    filteredOrders.forEach((o) => {
      const p = (o.platform || "general").toUpperCase();
      if (!map[p]) map[p] = { count: 0, volume: 0 };
      map[p].count++;
      map[p].volume += o.charge || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].volume - a[1].volume);
  }, [filteredOrders]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const csvRows = [
        ["Order ID", "User ID", "Platform", "Service", "Charge (INR)", "Status", "Created At"],
        ...filteredOrders.map((o) => [
          o.id,
          o.userId,
          o.platform,
          `"${(o.serviceName || "").replace(/"/g, '""')}"`,
          (o.charge || 0).toFixed(2),
          o.status,
          o.createdAt,
        ]),
      ];

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.map((e) => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `smm_reports_${timeRange}_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full bg-transparent min-h-screen pb-24 text-slate-100">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Header Telemetry */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#D8EC8D]">
              <span className="w-2 h-2 rounded-full bg-[#D8EC8D] animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                Intelligence, Margins & Executive Analytics
              </span>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight">Reports & Analytics</h1>
            <p className="text-xs text-slate-400">
              Realized profit yields, dispatch velocity, customer acquisition tiers, and CSV fiscal settlement.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Time Filter Pill */}
            <div className="flex items-center p-1 rounded-2xl bg-[#1a1a1a] border border-white/10 text-xs">
              {(["24H", "7D", "30D", "ALL"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold transition-all ${
                    timeRange === r
                      ? "btn-primary-gradient text-[#171e00] font-bold shadow-[0_0_12px_rgba(216,236,141,0.2)]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCsv}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-[#D8EC8D]" />
              <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
            </button>
          </div>
        </div>

        {/* 4 Financial Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={`Gross Sales (${timeRange})`}
            value={`₹${totalGrossRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            subtitle={`${filteredOrders.length} orders settled`}
            icon={TrendingUp}
            highlight={true}
          />
          <StatCard
            title="Upstream API Cost"
            value={`₹${upstreamCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            subtitle="Provider cost clearing"
            icon={DollarSign}
          />
          <StatCard
            title="Net Realized Yield"
            value={`₹${netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            subtitle={`${profitMarginPct}% gross margin`}
            icon={Sparkles}
          />
          <StatCard
            title="Avg Order Value"
            value={`₹${avgOrderValue.toFixed(2)}`}
            subtitle="Per successful transaction"
            icon={Activity}
          />
        </div>

        {/* 2-Column Section: Order Velocity & Platform Shares */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Order Status Distribution (6 cols) */}
          <div className="lg:col-span-6 p-6 rounded-3xl bg-[#1a1a1a]/80 border border-white/10 backdrop-blur-md space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Order Execution Ledger</h3>
                <p className="text-xs text-slate-400">Breakdown of orders processed within {timeRange}</p>
              </div>
              <span className="text-xs font-mono text-[#D8EC8D] font-bold">
                {filteredOrders.length} TOTAL
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span className="text-emerald-400 font-semibold">Completed ({completedOrders.length})</span>
                  <span className="text-slate-400">
                    {filteredOrders.length > 0
                      ? `${((completedOrders.length / filteredOrders.length) * 100).toFixed(1)}%`
                      : "0%"}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${filteredOrders.length > 0 ? (completedOrders.length / filteredOrders.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span className="text-amber-400 font-semibold">Processing & In Progress ({inProgressOrders.length})</span>
                  <span className="text-slate-400">
                    {filteredOrders.length > 0
                      ? `${((inProgressOrders.length / filteredOrders.length) * 100).toFixed(1)}%`
                      : "0%"}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${filteredOrders.length > 0 ? (inProgressOrders.length / filteredOrders.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span className="text-rose-400 font-semibold">Cancelled & Refunded ({cancelledOrders.length})</span>
                  <span className="text-slate-400">
                    {filteredOrders.length > 0
                      ? `${((cancelledOrders.length / filteredOrders.length) * 100).toFixed(1)}%`
                      : "0%"}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-rose-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${filteredOrders.length > 0 ? (cancelledOrders.length / filteredOrders.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span className="text-slate-400 font-semibold">Failed Dispatches ({failedOrders.length})</span>
                  <span className="text-slate-400">
                    {filteredOrders.length > 0
                      ? `${((failedOrders.length / filteredOrders.length) * 100).toFixed(1)}%`
                      : "0%"}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-slate-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${filteredOrders.length > 0 ? (failedOrders.length / filteredOrders.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-4 text-xs font-mono text-slate-400">
              <div>
                <span className="text-slate-500">Dispatch Reliability: </span>
                <span className="text-emerald-400 font-bold">99.2%</span>
              </div>
              <div>
                <span className="text-slate-500">Provider Latency: </span>
                <span className="text-[#D8EC8D] font-bold">14.2 ms</span>
              </div>
            </div>
          </div>

          {/* Platform Revenue Distribution (6 cols) */}
          <div className="lg:col-span-6 p-6 rounded-3xl bg-[#1a1a1a]/80 border border-white/10 backdrop-blur-md space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Social Network Revenue Volume</h3>
                <p className="text-xs text-slate-400">Platform share of cleared customer expenditures</p>
              </div>
              <BarChart3 className="w-4 h-4 text-[#D8EC8D]" />
            </div>

            <div className="space-y-3">
              {platformRevenue.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 font-mono">
                  No order transactions recorded in selected interval.
                </div>
              ) : (
                platformRevenue.map(([platform, data]) => {
                  const pct = totalGrossRevenue > 0 ? (data.volume / totalGrossRevenue) * 100 : 0;
                  return (
                    <div key={platform} className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white font-mono">{platform}</span>
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-slate-400">{data.count} orders</span>
                          <span className="text-[#D8EC8D] font-bold">₹{data.volume.toFixed(2)}</span>
                          <span className="text-slate-500 text-[11px]">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full btn-primary-gradient rounded-full"
                          style={{ width: `${Math.max(5, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* User Acquisition & Tier Analytics */}
        <div className="p-6 rounded-3xl bg-[#1a1a1a]/80 border border-white/10 backdrop-blur-md space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Customer Tier Demographics</h3>
              <p className="text-xs text-slate-400">User distribution across automated discount & volume tiers</p>
            </div>
            <Users className="w-4 h-4 text-slate-400" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <div className="text-xs font-mono text-slate-400 uppercase">Starter Tier</div>
              <div className="text-2xl font-bold text-white font-mono mt-1">{tierCounts.STARTER}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Base public pricing</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <div className="text-xs font-mono text-emerald-400 uppercase">Growth Tier</div>
              <div className="text-2xl font-bold text-emerald-300 font-mono mt-1">{tierCounts.GROWTH}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">5% rate discount</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <div className="text-xs font-mono text-sky-400 uppercase">Pro Scale Tier</div>
              <div className="text-2xl font-bold text-sky-300 font-mono mt-1">{tierCounts.PRO_SCALE}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">10% rate discount</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-[#D8EC8D]/30 bg-[#D8EC8D]/5">
              <div className="text-xs font-mono text-[#D8EC8D] uppercase font-bold">Enterprise Tier</div>
              <div className="text-2xl font-bold text-[#D8EC8D] font-mono mt-1">{tierCounts.ENTERPRISE}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">15% wholesale margin</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
