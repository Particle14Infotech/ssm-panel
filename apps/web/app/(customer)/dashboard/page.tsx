"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCustomer } from "@/context/CustomerContext";
import {
  Wallet,
  Activity,
  PlusCircle,
  ShoppingBag,
  TrendingUp,
  Clock,
  RefreshCw,
} from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { motion } from "framer-motion";

export default function CustomerDashboardPage() {
  const { user, orders, refillOrder } = useCustomer();
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-8 pb-16"
    >
      {/* 1. Header Clean (Badge removed & no beam glow) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight font-sans">Overview</h1>
          <p className="text-xs text-slate-400 font-sans">
            Welcome back, {user.name || "Customer"}. Real-time monitoring of your liquidity and active orders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/new-order"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold hover:brightness-105 shadow-sm transition-all font-sans"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Order</span>
          </Link>
        </div>
      </div>

      {/* 2. Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Available Balance"
          value={`₹${user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          subtitle="Instant spendable liquidity"
          icon={Wallet}
          highlight={true}
        />

        <StatCard
          title="Total Orders"
          value={orders.length.toLocaleString()}
          subtitle={`${completedCount} completed lifetime`}
          icon={Activity}
        />

        <StatCard
          title="In Progress"
          value={inProgressCount.toLocaleString()}
          subtitle={`${pendingCount} pending queue`}
          icon={Clock}
        />

        <StatCard
          title="Total Spent"
          value={`₹${totalSpent.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          subtitle="Lifetime volume charged"
          icon={TrendingUp}
        />
      </div>

      {/* 3. 7/30-Day Orders & Spend Trend Chart */}
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
                  ? "bg-[#D8EC8D] text-[#131313] shadow-sm font-bold"
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
                  ? "bg-[#D8EC8D] text-[#131313] shadow-sm font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              30 Days
            </button>
          </div>
        </div>

        {/* Bar Visualizer */}
        <div className="pt-4 space-y-2">
          <div className="h-44 flex items-end justify-between gap-1 sm:gap-2 border-b border-white/5 pb-2">
            {chartData.map((d, idx) => {
              const heightPercent = Math.max(Math.round((d.count / maxChartCount) * 100), 6);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full max-w-[28px] rounded-t-md bg-[#D8EC8D]/25 border border-[#D8EC8D]/40 group-hover:bg-[#D8EC8D] transition-all cursor-pointer relative"
                  >
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 bg-[#1c1b1b] border border-white/10 px-2.5 py-1 rounded-lg text-[10px] font-mono text-white whitespace-nowrap shadow-xl z-20 transition-all">
                      <div>{d.count} Orders</div>
                      <div className="text-[#D8EC8D]">₹{d.spend.toFixed(2)}</div>
                    </div>
                  </div>
                  {chartRange === "7d" && (
                    <span className="text-[10px] font-mono text-slate-500 truncate w-full text-center">
                      {d.date}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* 4. Recent Dispatched Orders Section */}
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
              <motion.button
                key={plat}
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedPlatform(plat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all shrink-0 flex items-center gap-1.5 border ${
                  selectedPlatform === plat
                    ? "bg-[#D8EC8D] text-[#131313] font-bold border-[#D8EC8D] shadow-sm"
                    : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                {plat !== "ALL" && (
                  <PlatformIcon platform={plat} size={14} useBrandColor={selectedPlatform !== plat} />
                )}
                <span>{plat === "ALL" ? "All Streams" : plat}</span>
              </motion.button>
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
                        <div className="flex items-center gap-1.5 mt-1">
                          <PlatformIcon platform={order.platform} size={13} useBrandColor={true} />
                          <span className="text-[10px] text-slate-400 uppercase font-mono">{order.platform}</span>
                        </div>
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
                              className="px-2.5 py-1 rounded-lg bg-[#D8EC8D]/15 hover:bg-[#D8EC8D]/25 text-[#D8EC8D] text-xs font-medium transition-all flex items-center gap-1"
                            >
                              <RefreshCw className={`w-3 h-3 ${refillingId === order.id ? "animate-spin" : ""}`} />
                              <span>Refill</span>
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
    </motion.div>
  );
}
