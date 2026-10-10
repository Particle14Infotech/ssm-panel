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
} from "lucide-react";

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
    <div className="w-full bg-[#0e0e0e] min-h-screen pb-20">
      {/* 1. LIGHT SPLIT TOP TIER (HIGH CONTRAST OPULENCE) */}
      <section className="w-full bg-[#F5F5F8] text-[#131313] px-4 md:px-8 pt-8 pb-12 rounded-b-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="max-w-[1560px] mx-auto space-y-6">
          {/* Top Bar: Telemetry Pill & Calendar Strip */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md shadow-sm border border-black/5">
              <span className="text-[#5b6b1b] font-bold text-xs">✦</span>
              <span className="text-xs font-medium text-[#353534] tracking-wide">
                Algorithmic Router V4.9 Live • Sub-second delivery cluster active
              </span>
              <span className="w-2 h-2 rounded-full bg-[#bccf74] animate-pulse" />
            </div>

            <div className="flex items-center gap-2 bg-white/90 p-1.5 rounded-full shadow-sm border border-black/5">
              {[
                { day: "Mon", date: "12", active: true },
                { day: "Tue", date: "13", active: false },
                { day: "Wed", date: "14", active: false, accent: "pink" },
                { day: "Thu", date: "15", active: false },
                { day: "Fri", date: "16", active: false },
              ].map((item) => (
                <div
                  key={item.day}
                  className={`flex flex-col items-center justify-center w-10 h-12 rounded-full text-center transition-all ${
                    item.active
                      ? "bg-[#131313] text-white shadow-md"
                      : "text-[#555] hover:bg-black/5"
                  }`}
                >
                  <span className="text-[10px] uppercase font-mono opacity-70">{item.day}</span>
                  <span className="text-sm font-bold leading-none">{item.date}</span>
                  <span
                    className={`w-1 h-1 rounded-full mt-1 ${
                      item.accent === "pink" ? "bg-[#ffafd5]" : "bg-[#d8ec8d]"
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Main Top Grid (3 : 6 : 3 split) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
            {/* Col 1: Platform Matrix Banner */}
            <div className="xl:col-span-3 rounded-3xl overflow-hidden relative flex flex-col justify-between p-6 bg-white shadow-sm border border-black/5 group min-h-[300px]">
              <div className="flex items-center justify-between relative z-10">
                <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md shadow-sm text-[10px] uppercase tracking-widest font-bold text-[#131313] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#bccf74]" />
                  Telemetry Node
                </span>
                <div className="px-3 py-1 rounded-full bg-[#131313] text-white shadow-md flex items-center gap-1.5">
                  <span className="text-[10px] text-[#bccf74] uppercase tracking-wider font-mono">Spending</span>
                  <span className="text-xs font-bold font-mono">78%</span>
                </div>
              </div>

              <div className="relative z-10 mt-auto pt-8">
                <span className="text-[11px] uppercase tracking-widest text-[#777] font-semibold block">
                  Platform Matrix
                </span>
                <h1 className="text-3xl font-light text-[#131313] tracking-tight leading-tight">
                  Command Hub
                </h1>
                <p className="text-xs text-[#666] mt-1 font-light">
                  Real-time network allocation & fulfillment velocity.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Link
                    href="/new-order"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#131313] text-white text-xs font-semibold hover:bg-black/80 transition-all shadow-md"
                  >
                    <span>Create Dispatch</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#DBEF90]" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Col 2: 2x2 Metric Tiles */}
            <div className="xl:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tile 1: Wallet Balance */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5 flex flex-col justify-between hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[#777] font-semibold">Wallet Liquidity</span>
                  <Link href="/wallet" className="p-1.5 rounded-full hover:bg-black/5 text-[#131313]">
                    <CreditCard className="w-4 h-4" />
                  </Link>
                </div>
                <div className="my-3 flex items-baseline justify-between">
                  <span className="text-3xl font-extralight text-[#131313] tracking-tight">
                    ₹{user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[11px] font-bold text-[#2a3400] bg-[#d8ec8d] px-2 py-0.5 rounded-full">
                    +14.2%
                  </span>
                </div>
                {/* Sparkline curve */}
                <div className="pt-2">
                  <svg className="w-full h-7 overflow-visible" fill="none" viewBox="0 0 200 28">
                    <path
                      d="M0 22 C 30 20, 50 26, 80 14 C 110 6, 140 18, 192 4"
                      stroke="#131313"
                      strokeLinecap="round"
                      strokeWidth="1.75"
                    />
                    <polygon fill="#131313" points="190,1 198,4 191,8" />
                  </svg>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-[#888] font-mono">
                    <span>Threshold: ₹500</span>
                    <span className="text-emerald-600 font-semibold">Instant Ready</span>
                  </div>
                </div>
              </div>

              {/* Tile 2: Total Orders */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5 flex flex-col justify-between hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[#777] font-semibold">Aggregated Orders</span>
                  <Activity className="w-4 h-4 text-[#131313]" />
                </div>
                <div className="my-3 flex items-baseline justify-between">
                  <span className="text-3xl font-extralight text-[#131313] tracking-tight">{orders.length}</span>
                  <span className="text-[11px] text-[#131313] bg-[#E5E2E1] px-2.5 py-0.5 rounded-full font-mono">
                    Active
                  </span>
                </div>
                {/* Waveform visual bars */}
                <div className="pt-2">
                  <div className="flex items-end gap-1.5 h-7 w-full justify-between">
                    {[12, 18, 24, 15, 22, 28, 26, 19, 14, 23, 28, 16].map((h, i) => (
                      <div
                        key={i}
                        className={`w-full rounded-full transition-all ${
                          i >= 5 && i <= 7 ? "bg-[#bccf74]" : "bg-[#131313]"
                        }`}
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-[#888] font-mono">
                    <span>Real-time dispatch</span>
                    <span>18 node vectors</span>
                  </div>
                </div>
              </div>

              {/* Tile 3: Fulfillment Status */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5 flex flex-col justify-between hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[#777] font-semibold">Fulfillment SLA</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#bccf74]" />
                    <span className="text-xs font-bold text-[#131313] font-mono">99.8%</span>
                  </div>
                </div>
                <div className="my-3 flex items-baseline gap-4">
                  <div>
                    <span className="text-3xl font-extralight text-[#131313] leading-none">{completedCount}</span>
                    <span className="text-[10px] text-[#777] uppercase tracking-wider block font-semibold">Completed</span>
                  </div>
                  <div className="border-l border-black/10 pl-4">
                    <span className="text-xl font-bold text-[#131313] leading-none">{inProgressCount}</span>
                    <span className="text-[10px] text-[#777] uppercase tracking-wider block font-semibold">In Pipeline</span>
                  </div>
                </div>
                {/* Dot matrix progress */}
                <div className="pt-2">
                  <div className="grid grid-cols-12 gap-1">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 rounded-sm ${
                          i < 10 ? "bg-[#131313]" : i === 10 ? "bg-[#bccf74]" : "bg-[#E5E2E1]"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-[#888] font-mono">
                    <span>Matrix delivery</span>
                    <span>&lt; 30ms latency</span>
                  </div>
                </div>
              </div>

              {/* Tile 4: Queue & Exceptions */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5 flex flex-col justify-between hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[#777] font-semibold">Exceptions & Queue</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffafd5]/20 text-[#620042] font-semibold">
                    0% Drop
                  </span>
                </div>
                <div className="my-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extralight text-[#131313] leading-none">{pendingCount}</span>
                      <span className="text-[10px] text-[#777] uppercase font-semibold">Pending</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-normal text-[#909281] leading-none">{exceptionCount}</span>
                      <span className="text-[10px] text-[#909281] uppercase font-semibold">Cancelled/Partial</span>
                    </div>
                  </div>
                  {/* Radial SVG Ring */}
                  <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" fill="none" r="15" stroke="#E5E2E1" strokeWidth="2.5" />
                      <circle
                        cx="18"
                        cy="18"
                        fill="none"
                        r="15"
                        stroke="#131313"
                        strokeDasharray="94.2"
                        strokeDashoffset="22"
                        strokeLinecap="round"
                        strokeWidth="2.5"
                      />
                    </svg>
                    <span className="absolute w-2 h-2 rounded-full bg-[#ffafd5]" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#888] font-mono">
                  <span>Auto-reroute: Active</span>
                  <span>Health 100%</span>
                </div>
              </div>
            </div>

            {/* Col 3: Magenta Tier Bonus Promo Card */}
            <div className="xl:col-span-3 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between text-white shadow-xl bg-gradient-to-br from-[#FF1A8C] via-[#BD0183] to-[#40002A]">
              <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-[#FFAFD5]/20 blur-2xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] uppercase tracking-widest font-bold">
                    Tier Bonus
                  </span>
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-xl font-normal text-white tracking-tight leading-snug">
                  Deposit ₹1,000, get ₹100 instant credit
                </h3>
                <p className="text-xs text-white/80 mt-2 font-light">
                  Direct boost credited into high-speed liquidity balance with zero delays.
                </p>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-white/90 uppercase tracking-wider font-mono">
                  <span>Daily Quota Claimed</span>
                  <span className="font-bold text-white">65%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-black/30 overflow-hidden p-0.5">
                  <div className="h-full rounded-full bg-white transition-all" style={{ width: "65%" }} />
                </div>
                <Link
                  href="/wallet"
                  className="w-full py-2.5 px-4 rounded-full bg-white text-[#131313] hover:bg-white/90 transition-all text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 shadow-lg"
                >
                  <span>Claim Bonus Now</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. NOTCHED SECTION DIVIDER */}
      <div className="w-full -mt-4 mb-4 z-20 flex justify-center items-center">
        <div className="bg-[#201f1f] border border-white/10 px-6 py-2 rounded-full shadow-2xl flex items-center gap-3 text-white text-xs">
          <span className="w-2 h-2 rounded-full bg-[#DBEF90] animate-pulse" />
          <span className="font-mono uppercase tracking-widest text-[#DBEF90] font-semibold">
            Live Stream Feed
          </span>
          <span className="text-white/40">•</span>
          <span className="text-on-surface-variant text-xs">{orders.length} Vectors Managed</span>
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
        <div className="bg-[#1c1b1b]/80 border border-white/10 rounded-3xl p-4 md:p-6 backdrop-blur-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#DBEF90] animate-pulse" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                Active Execution Stream
              </h2>
            </div>
            <span className="text-xs text-on-surface-variant font-mono">
              Auto-refreshed with &lt; 40ms sync
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-on-surface-variant font-mono">
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
                    <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                      No orders found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.slice(0, 8).map((order) => (
                    <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="py-4 px-3 font-mono font-bold text-white whitespace-nowrap">
                        <span className="text-[#DBEF90] mr-1">✦</span>
                        {order.id}
                      </td>
                      <td className="py-4 px-3">
                        <div className="font-medium text-white max-w-xs truncate">{order.serviceName}</div>
                        <div className="text-[10px] text-on-surface-variant uppercase font-mono mt-0.5">
                          {order.platform}
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <a
                          href={order.target}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-on-surface-variant hover:text-[#DBEF90] max-w-[200px] truncate transition-colors font-mono"
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
                          <div className="text-[10px] text-on-surface-variant">
                            Remains: {order.remains.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-3 font-mono font-semibold text-[#DBEF90]">
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
                              className="px-3 py-1 rounded-full bg-white/5 hover:bg-[#DBEF90]/20 text-[#DBEF90] border border-white/10 hover:border-[#DBEF90]/40 text-[11px] font-semibold transition-all flex items-center gap-1"
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
        </div>
      </section>
    </div>
  );
}
