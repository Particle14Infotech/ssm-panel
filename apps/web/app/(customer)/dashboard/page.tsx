"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCustomer } from "@/context/CustomerContext";
import {
  Wallet,
  Activity,
  ArrowUpRight,
  PlusCircle,
  ShoppingBag,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Layers,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";

export default function CustomerDashboardPage() {
  const { user, orders, refillOrder, cancelOrder } = useCustomer();
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [chartRange, setChartRange] = useState<"7d" | "30d">("7d");
  const [refillingId, setRefillingId] = useState<string | null>(null);

  const totalSpent = orders.reduce((acc, o) => acc + (o.charge || 0), 0);
  const inProgressCount = orders.filter((o) => o.status === "IN_PROGRESS" || o.status === "PROCESSING").length;
  const completedCount = orders.filter((o) => o.status === "COMPLETED").length;
  const pendingCount = orders.filter((o) => o.status === "PENDING").length;

  const filteredOrders = selectedPlatform === "ALL"
    ? orders
    : orders.filter((o) => o.platform?.toLowerCase() === selectedPlatform.toLowerCase());

  const handleRefill = async (orderId: string) => {
    setRefillingId(orderId);
    await refillOrder(orderId);
    setTimeout(() => setRefillingId(null), 1000);
  };

  // Generate real daily buckets for 7d / 30d orders & spend chart
  const daysCount = chartRange === "7d" ? 7 : 30;
  const chartData = Array.from({ length: daysCount }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (daysCount - 1 - idx));
    const dateStr = d.toISOString().split("T")[0];
    const dayOrders = orders.filter((o) => o.createdAt && o.createdAt.startsWith(dateStr));
    const count = dayOrders.length;
    const spend = dayOrders.reduce((acc, o) => acc + (o.charge || 0), 0);
    return {
      date: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      count,
      spend,
    };
  });

  const maxChartCount = Math.max(...chartData.map((d) => d.count), 5);

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header Telemetry & Quick CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#D8EC8D]/10 border border-[#D8EC8D]/25 text-xs font-medium text-[#D8EC8D]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D8EC8D] animate-pulse" />
            <span>Live Operational Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight font-sans">Overview</h1>
          <p className="text-xs text-slate-400 font-sans">
            Welcome back, {user.name || "Customer"}. Real-time monitoring of your liquidity and active orders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/new-order"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold shadow-[0_0_20px_rgba(216,236,141,0.25)] transition-all font-sans"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Order</span>
          </Link>
        </div>
      </div>

      {/* 2. Primary KPI Cards Grid (12-col grid, equal height) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Available Balance */}
        <StatCard
          title="Available Balance"
          value={`₹${user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          subtitle="Instant spendable liquidity"
          icon={Wallet}
          highlight={true}
        />

        {/* Total Orders */}
        <StatCard
          title="Total Orders"
          value={orders.length.toLocaleString()}
          subtitle={`${completedCount} completed lifetime`}
          icon={Activity}
        />

        {/* In Progress */}
        <StatCard
          title="In Progress"
          value={inProgressCount.toLocaleString()}
          subtitle={`${pendingCount} pending queue`}
          icon={Clock}
        />

        {/* Total Spent */}
        <StatCard
          title="Total Spent"
          value={`₹${totalSpent.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          subtitle="Lifetime volume charged"
          icon={TrendingUp}
        />
      </div>

      {/* 3. 7/30-Day Orders & Spend Trend Chart (GlassCard) */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold tracking-wide text-white font-sans">
              Activity & Liquidity Velocity
            </h2>
            <p className="text-xs text-slate-400 font-sans">Daily order dispatch volume across selected window.</p>
          </div>

          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 self-start">
            <button
              type="button"
              onClick={() => setChartRange("7d")}
              className={`px-3 py-1 rounded-lg text-xs font-bold font-sans transition-all ${
                chartRange === "7d"
                  ? "bg-[#D8EC8D] text-[#131313] shadow-sm shadow-[#D8EC8D]/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setChartRange("30d")}
              className={`px-3 py-1 rounded-lg text-xs font-bold font-sans transition-all ${
                chartRange === "30d"
                  ? "bg-[#D8EC8D] text-[#131313] shadow-sm shadow-[#D8EC8D]/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              30 Days
            </button>
          </div>
        </div>

        {/* Chart Visualization */}
        <div className="h-44 w-full pt-4 flex items-end justify-between gap-1 sm:gap-2 border-b border-white/5 pb-2">
          {chartData.map((d, i) => {
            const hasActivity = d.count > 0;
            const heightPct = hasActivity
              ? Math.max(Math.round((d.count / maxChartCount) * 100), 18)
              : 8;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                <div className="w-full relative flex items-end justify-center h-32">
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full max-w-[28px] rounded-t-lg transition-all relative ${
                      hasActivity
                        ? "bg-gradient-to-t from-[#8EAC11] to-[#D8EC8D] shadow-[0_0_12px_rgba(216,236,141,0.3)] opacity-90 group-hover:opacity-100"
                        : "bg-white/5 group-hover:bg-[#D8EC8D]/20"
                    }`}
                  >
                    {/* Tooltip on Hover */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                      <div className="bg-[#131313] border border-[#D8EC8D]/40 px-2.5 py-1 rounded-lg shadow-xl text-[11px] font-sans tabular-nums text-white whitespace-nowrap">
                        {d.count} orders (₹{d.spend.toFixed(0)})
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-sans text-slate-400 truncate max-w-[42px] text-center">
                  {d.date}
                </span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* 4. Recent Orders Table & Platform Filtering */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
              Recent Dispatched Orders
            </h2>
            <p className="text-xs text-slate-400">Scoped exclusively to your authenticated identity.</p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {["ALL", "instagram", "youtube", "tiktok", "telegram", "twitter"].map((plat) => (
              <button
                key={plat}
                type="button"
                onClick={() => setSelectedPlatform(plat)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-all shrink-0 ${
                  selectedPlatform === plat
                    ? "bg-[#D8EC8D] text-[#131313] font-bold shadow-sm shadow-[#D8EC8D]/30"
                    : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {plat === "ALL" ? "All Streams" : plat}
              </button>
            ))}
          </div>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No orders yet"
            description="You have not placed any orders yet. Place your first order to get started."
            actionText="Place your first order"
            actionHref="/new-order"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                  <th className="py-3 px-3">Order ID</th>
                  <th className="py-3 px-3">Service</th>
                  <th className="py-3 px-3">Target Vector</th>
                  <th className="py-3 px-3">Quantity</th>
                  <th className="py-3 px-3">Charge</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-mono">
                      No orders found under selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.slice(0, 8).map((order) => (
                    <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-3 font-mono font-semibold text-white whitespace-nowrap">
                        <span className="text-[#D8EC8D] mr-1.5 font-bold">#</span>
                        {order.id}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-white max-w-xs truncate">{order.serviceName}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-mono">{order.platform}</div>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-400">
                        <span className="max-w-[180px] truncate block" title={order.target}>
                          {order.target}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono">
                        <span className="text-white font-medium">{order.quantity.toLocaleString()}</span>
                        {order.remains !== null && order.remains !== undefined && (
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Remains: {order.remains.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-semibold text-white">
                        ₹{order.charge.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {order.refillable && (
                            <button
                              type="button"
                              onClick={() => handleRefill(order.id)}
                              disabled={refillingId === order.id}
                              className="px-2.5 py-1 rounded-lg bg-[#D8EC8D]/15 hover:bg-[#D8EC8D]/25 text-[#D8EC8D] text-xs font-semibold transition-all inline-flex items-center gap-1"
                            >
                              <RefreshCw className={`w-3 h-3 ${refillingId === order.id ? "animate-spin" : ""}`} />
                              <span>{refillingId === order.id ? "Refilling" : "Refill"}</span>
                            </button>
                          )}
                          {order.cancellable && (
                            <button
                              type="button"
                              onClick={() => cancelOrder(order.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold transition-all"
                            >
                              Cancel
                            </button>
                          )}
                          <Link
                            href={`/new-order?serviceId=${order.serviceId}`}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium transition-all"
                          >
                            Reorder
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
