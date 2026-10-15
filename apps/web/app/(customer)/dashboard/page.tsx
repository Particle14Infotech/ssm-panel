"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCustomer } from "@/context/CustomerContext";
import {
  Zap,
  TrendingUp,
  ArrowUpRight,
  Activity,
  Layers,
  Sparkles,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Sliders,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  PlusCircle,
  Calendar,
  CreditCard,
  Radio,
  ShoppingBag,
} from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { EmptyState } from "@/components/shared/EmptyState";

export default function CustomerDashboardPage() {
  const { user, orders, refillOrder, cancelOrder } = useCustomer();
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [refillingId, setRefillingId] = useState<string | null>(null);

  const completedCount = orders.filter((o) => o.status === "COMPLETED").length;
  const inProgressCount = orders.filter((o) => o.status === "IN_PROGRESS" || o.status === "PROCESSING").length;
  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  const exceptionCount = orders.filter((o) => o.status === "CANCELLED" || o.status === "REFUNDED" || o.status === "PARTIAL").length;

  const filteredOrders = selectedPlatform === "ALL"
    ? orders
    : orders.filter((o) => o.platform.toLowerCase() === selectedPlatform.toLowerCase());

  const handleRefill = async (orderId: string) => {
    setRefillingId(orderId);
    await refillOrder(orderId);
    setTimeout(() => setRefillingId(null), 1000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#DBEF90]/15 text-[#DBEF90] border border-[#DBEF90]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#DBEF90]" />
            Completed
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            In Progress
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Processing
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-300 border border-slate-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Pending
          </span>
        );
      case "PARTIAL":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            Partial
          </span>
        );
      case "CANCELLED":
      case "REFUNDED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="w-full bg-[#0e0e0e] min-h-screen pb-24 text-[#e5e2e1]">
      {/* 1. DARK GLASSMORPHIC COMMAND CENTER */}
      <section className="w-full px-4 md:px-8 pt-6 pb-10 relative">
        <div className="max-w-[1560px] mx-auto space-y-6">
          {/* Top Bar: Live Status */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-md shadow-lg">
              <span className="text-blue-400 font-bold text-xs">✦</span>
              <span className="text-xs font-mono text-slate-300 tracking-wide">
                Live Session • Secure JWT Identity Scoped
              </span>
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/wallet"
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-semibold hover:bg-blue-600/30 transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Funds</span>
              </Link>
            </div>
          </div>

          {/* Main Top Grid (3 : 6 : 3 split) with frosted glass squircle tiles */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
            {/* Col 1: Account Matrix */}
            <GlassCard variant="squircle" className="xl:col-span-3 overflow-hidden relative flex flex-col justify-between p-6 group min-h-[300px]">
              <div className="flex items-center justify-between relative z-10">
                <span className="px-3 py-1 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/10 text-[10px] uppercase tracking-widest font-bold text-blue-400 flex items-center gap-1.5 font-mono">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  Account Hub
                </span>
                <div className="px-3 py-1 rounded-full bg-white/[0.08] border border-white/10 text-white shadow-md flex items-center gap-1.5 font-mono">
                  <span className="text-[10px] text-blue-400 uppercase tracking-wider">Tier</span>
                  <span className="text-xs font-bold">{user.tier || "STANDARD"}</span>
                </div>
              </div>

              <div className="relative z-10 mt-auto pt-8">
                <span className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold block font-mono">
                  Real-time Overview
                </span>
                <h1 className="text-3xl font-light text-white tracking-tight leading-tight">
                  Dashboard
                </h1>
                <p className="text-xs text-slate-400 mt-1 font-light">
                  Track orders, wallet liquidity, and support tickets.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Link
                    href="/new-order"
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
                  >
                    <span>Place New Order</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </GlassCard>

            {/* Col 2: 2x2 Metric Tiles in Frosted Glass Squircle */}
            <div className="xl:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tile 1: Wallet Balance */}
              <GlassCard variant="squircle" className="p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold font-mono">Available Balance</span>
                  <Link href="/wallet" className="p-1.5 rounded-full hover:bg-white/10 text-blue-400">
                    <CreditCard className="w-4 h-4" />
                  </Link>
                </div>
                <div className="my-3 flex items-baseline justify-between">
                  <span className="text-3xl font-light text-white tracking-tight">
                    ₹{user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                  <Link
                    href="/wallet"
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full"
                  >
                    + Add Funds
                  </Link>
                </div>
                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-white/5">
                  <span>Currency: INR</span>
                  <span className="text-blue-400">Instant Ready</span>
                </div>
              </GlassCard>

              {/* Tile 2: Total Orders */}
              <GlassCard variant="squircle" className="p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold font-mono">Total Orders</span>
                  <Activity className="w-4 h-4 text-blue-400" />
                </div>
                <div className="my-3 flex items-baseline justify-between">
                  <span className="text-3xl font-light text-white tracking-tight">{orders.length}</span>
                  <span className="text-[11px] text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-mono">
                    Lifetime
                  </span>
                </div>
                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-white/5">
                  <span>In Progress</span>
                  <span className="text-white font-semibold">{inProgressCount}</span>
                </div>
              </GlassCard>

              {/* Tile 3: Completed Orders */}
              <GlassCard variant="squircle" className="p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold font-mono">Fulfilled</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="my-3 flex items-baseline gap-4">
                  <div>
                    <span className="text-3xl font-light text-white leading-none">{completedCount}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mt-1 font-mono">Completed</span>
                  </div>
                  <div className="border-l border-white/10 pl-4">
                    <span className="text-2xl font-light text-white leading-none">{pendingCount}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mt-1 font-mono">Pending</span>
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-white/5">
                  <span>Execution Rate</span>
                  <span className="text-slate-300 font-semibold">
                    {orders.length > 0 ? `${Math.round((completedCount / orders.length) * 100)}%` : "0%"}
                  </span>
                </div>
              </GlassCard>

              {/* Tile 4: Total Spent */}
              <GlassCard variant="squircle" className="p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold font-mono">Total Spent</span>
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                </div>
                <div className="my-3 flex items-baseline justify-between">
                  <span className="text-3xl font-light text-white tracking-tight">
                    ₹{orders.reduce((acc, o) => acc + (o.charge || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 font-semibold border border-white/10 font-mono">
                    {exceptionCount} Exception{exceptionCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-white/5">
                  <span>Ledger Transactions</span>
                  <Link href="/transactions" className="text-blue-400 hover:underline">View History</Link>
                </div>
              </GlassCard>
            </div>

            {/* Col 3: Quick Action Card */}
            <GlassCard variant="squircle" className="xl:col-span-3 p-6 relative overflow-hidden flex flex-col justify-between bg-gradient-to-br from-blue-900/20 via-slate-900/40 to-[#02040A] border border-white/[0.1]">
              <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] uppercase tracking-widest font-bold text-blue-400 font-mono">
                    Quick Start
                  </span>
                  <Sparkles className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-xl font-normal text-white tracking-tight leading-snug">
                  Boost Your Social Growth
                </h3>
                <p className="text-xs text-slate-300 mt-2 font-light">
                  Order high-speed followers, likes, views, and engagement across all major platforms.
                </p>
              </div>

              <div className="mt-6 space-y-3">
                <Link
                  href="/services-catalog"
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-all text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <span>Explore Services</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/new-order"
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30"
                >
                  <span>Create First Order</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* 2. LIVE FEED DIVIDER */}
      <div className="w-full -mt-2 mb-6 z-20 flex justify-center items-center">
        <div className="px-6 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-md shadow-2xl flex items-center gap-3 text-white text-xs">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="font-mono uppercase tracking-widest text-blue-400 font-semibold">
            Execution Ledger
          </span>
          <span className="text-white/40">•</span>
          <span className="text-slate-300 text-xs font-mono">{orders.length} Active Orders</span>
        </div>
      </div>

      {/* 3. BOTTOM DARK COMMAND CENTER (ORDERS STREAM & LIVE ACTIONS) */}
      <section className="max-w-[1560px] mx-auto px-4 md:px-8 mt-6 space-y-6">
        {/* Controls Bar: Platform Tabs & Quick Dispatch Action */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#1c1b1b] border border-white/10 overflow-x-auto">
            {["ALL", "instagram", "tiktok", "youtube", "telegram", "twitter", "spotify"].map((platform) => (
              <button
                key={platform}
                onClick={() => setSelectedPlatform(platform)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all whitespace-nowrap ${
                  selectedPlatform === platform
                    ? "bg-[#d8ec8d] text-[#2a3400] shadow-[0_0_15px_rgba(219,239,144,0.3)]"
                    : "text-on-surface-variant hover:text-white hover:bg-white/5"
                }`}
              >
                {platform === "ALL" ? "All Streams" : platform}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/orders"
              className="px-4 py-2 rounded-full bg-surface-container-low border border-white/10 hover:bg-surface-container-high text-xs font-semibold text-white transition-all flex items-center gap-2"
            >
              <span>View Full Ledger</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              href="/new-order"
              className="px-5 py-2 rounded-full bg-[#d8ec8d] text-[#2a3400] hover:brightness-110 text-xs font-bold transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(219,239,144,0.25)]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Order</span>
            </Link>
          </div>
        </div>

        {/* Live Stream Orders Table */}
        <div className="glass-panel p-4 md:p-6 rounded-3xl overflow-hidden">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-400 animate-pulse" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                Recent Orders
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Live Session Data
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={ShoppingBag}
                title="No orders yet"
                description="You haven't placed any orders yet. Select a service to launch your first social media campaign."
                actionText="Place your first order"
                actionHref="/new-order"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                    <th className="py-3 px-3">Order ID</th>
                    <th className="py-3 px-3">Service & Platform</th>
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
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No orders found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.slice(0, 8).map((order) => (
                      <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-4 px-3 font-mono font-bold text-white whitespace-nowrap">
                          <span className="text-blue-400 mr-1">✦</span>
                          {order.id}
                        </td>
                        <td className="py-4 px-3">
                          <div className="font-medium text-white max-w-xs truncate">{order.serviceName}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-mono mt-0.5">
                            {order.platform}
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <a
                            href={order.target}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-400 hover:text-blue-400 max-w-[200px] truncate transition-colors font-mono"
                          >
                            <span className="truncate">{order.target}</span>
                            <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                          </a>
                        </td>
                        <td className="py-4 px-3 font-mono">
                          <div className="text-white font-semibold">
                            {order.quantity.toLocaleString()} units
                          </div>
                          {order.remains !== null && order.remains !== undefined && (
                            <div className="text-[10px] text-slate-400">
                              Remains: {order.remains.toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-3 font-mono font-semibold text-blue-400">
                          ₹{order.charge.toFixed(2)}
                        </td>
                        <td className="py-4 px-3 whitespace-nowrap">
                          {getStatusBadge(order.status)}
                        </td>
                        <td className="py-4 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {order.refillable && (
                              <button
                                onClick={() => handleRefill(order.id)}
                                disabled={refillingId === order.id}
                                className="px-3 py-1 rounded-full bg-white/5 hover:bg-blue-500/20 text-blue-400 border border-white/10 hover:border-blue-500/40 text-[11px] font-semibold transition-all flex items-center gap-1"
                                title="Trigger Refill Daemon"
                              >
                                <RefreshCw className={`w-3 h-3 ${refillingId === order.id ? "animate-spin" : ""}`} />
                                <span>{refillingId === order.id ? "Refilling..." : "Refill"}</span>
                              </button>
                            )}
                            {order.cancellable && (
                              <button
                                onClick={() => cancelOrder(order.id)}
                                className="px-3 py-1 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-semibold transition-all"
                              >
                                Cancel
                              </button>
                            )}
                            <Link
                              href={`/new-order?serviceId=${order.serviceId}`}
                              className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white text-[11px] font-semibold transition-all"
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
      </section>
    </div>
  );
}
