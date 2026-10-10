"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAdmin } from "@/context/AdminContext";
import {
  TrendingUp,
  Activity,
  Users,
  DollarSign,
  Server,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Shield,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Sliders,
  RotateCcw,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { users, services, orders, providers, transactions, syncProvider, updateOrderStatus } = useAdmin();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const totalRevenue = orders.reduce((acc, o) => acc + o.charge, 0) + 1428450;
  const upstreamCost = Math.round(totalRevenue * 0.624);
  const netProfit = totalRevenue - upstreamCost;

  const handleSync = async (providerId: string) => {
    setSyncingId(providerId);
    await syncProvider(providerId);
    setTimeout(() => setSyncingId(null), 800);
  };

  return (
    <div className="w-full bg-[#0e0e0e] min-h-screen pb-24 text-on-surface">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-6 space-y-8">
        {/* System Protocol Banner */}
        <div className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container-low border border-white/10 shadow-sm text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-[#DBEF90] animate-pulse" />
            <span className="text-on-surface-variant uppercase tracking-widest text-[11px]">
              SYSTEM PROTOCOL: Node cluster AP-S1 operating at 99.98% throughput • High-frequency provider synchronization active
            </span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-xs font-mono text-on-surface-variant">
            <span>SHARD: 0x9AF4 • KERNEL v8.4.1</span>
            <span className="text-[#DBEF90] font-bold">✦ AUTO RE-ROUTE ON</span>
          </div>
        </div>

        {/* 1. LIGHT HIGH-KEY SPLIT TOP CONTAINER */}
        <section className="w-full rounded-[2.5rem] bg-[#F5F5F8] text-[#131313] shadow-2xl p-6 md:p-8 relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-black/10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-widest font-bold text-[#666] font-mono">
                    Telemetry Core
                  </span>
                  <span className="text-[#5b6b1b] text-xl font-bold">*</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-light text-[#131313] tracking-tight">
                  Admin Master Dashboard
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex p-1 rounded-full bg-black/5 text-xs font-semibold">
                  <button className="px-4 py-1.5 rounded-full bg-[#131313] text-white shadow-sm">
                    Realtime (30D)
                  </button>
                  <button className="px-4 py-1.5 rounded-full text-[#666] hover:text-[#131313]">
                    Q3 Rolling
                  </button>
                  <button className="px-4 py-1.5 rounded-full text-[#666] hover:text-[#131313]">
                    Fiscal YTD
                  </button>
                </div>
              </div>
            </div>

            {/* 4 Operational Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-[#777] font-semibold">Registered Users</span>
                  <span className="text-[11px] font-bold text-[#2a3400] bg-[#d8ec8d] px-2 py-0.5 rounded-full">+12.4%</span>
                </div>
                <div className="my-2">
                  <span className="text-2xl font-light text-[#131313] font-mono">48,290</span>
                </div>
                <div className="text-[10px] text-[#888] font-mono">14,810 Active This Week</div>
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-[#777] font-semibold">Total Orders</span>
                  <Activity className="w-3.5 h-3.5 text-[#131313]" />
                </div>
                <div className="my-2">
                  <span className="text-2xl font-light text-[#131313] font-mono">642,850</span>
                </div>
                <div className="text-[10px] text-[#888] font-mono">3,420 Today (↑ 8.2%)</div>
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-[#777] font-semibold">Active Services</span>
                  <span className="w-2 h-2 rounded-full bg-[#bccf74]" />
                </div>
                <div className="my-2">
                  <span className="text-2xl font-light text-[#131313] font-mono">{services.length}</span>
                </div>
                <div className="text-[10px] text-[#888] font-mono">Across 7 Social Networks</div>
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-[#777] font-semibold">Connected Providers</span>
                  <Server className="w-3.5 h-3.5 text-[#131313]" />
                </div>
                <div className="my-2">
                  <span className="text-2xl font-light text-[#131313] font-mono">{providers.length}</span>
                </div>
                <div className="text-[10px] text-emerald-600 font-mono font-semibold">100% Health Status</div>
              </div>
            </div>

            {/* 4 Highlight Financial Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Gross Ingress */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider text-[#777] font-semibold">Gross Ingress</span>
                    <span className="text-[10px] font-mono bg-black/5 px-2 py-0.5 rounded-full font-bold">+18.2% MoM</span>
                  </div>
                  <span className="text-3xl font-extralight text-[#131313] tracking-tight block font-mono">
                    ₹{totalRevenue.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] text-[#888] font-mono">.00 INR GROSS</span>
                </div>
                <div className="pt-3">
                  <svg className="w-full h-7 text-[#131313]" fill="none" viewBox="0 0 160 28">
                    <path
                      d="M0 24 C20 20, 40 26, 60 14 C80 6, 100 16, 120 8 C140 3, 150 6, 160 2"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <div className="flex justify-between text-[10px] text-[#888] font-mono pt-1">
                    <span>Day 01</span>
                    <span>Peak Ingress</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Upstream Expenditure */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider text-[#777] font-semibold">Upstream Cost</span>
                    <span className="text-[10px] text-[#888] font-mono">62.4% ratio</span>
                  </div>
                  <span className="text-3xl font-extralight text-[#131313] tracking-tight block font-mono">
                    ₹{upstreamCost.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] text-[#888] font-mono">.00 INR PROVIDERS</span>
                </div>
                <div className="pt-3 space-y-1.5">
                  <div className="w-full bg-black/10 h-2 rounded-full overflow-hidden flex">
                    <div className="bg-[#131313] h-full" style={{ width: "62.4%" }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#888] font-mono">
                    <span>Direct API Sinks</span>
                    <span>Buffer Safe</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Signature Magenta Net Profit Card */}
              <div className="rounded-3xl p-5 shadow-xl flex flex-col justify-between text-white relative overflow-hidden bg-gradient-to-br from-[#BD0183] via-[#d80064] to-[#40002A]">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider text-white/80 font-semibold">Net Profit / Margin</span>
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-3xl font-extralight text-white tracking-tight block font-mono">
                    ₹{netProfit.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] text-white/80 font-mono">+37.6% NET YIELD</span>
                </div>
                <div className="pt-3">
                  <div className="text-[10px] text-white/90 font-mono flex items-center justify-between">
                    <span>Auto-Sweep to Treasury</span>
                    <span className="font-bold">Active</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Liquidity Pool */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider text-[#777] font-semibold">Customer Balances</span>
                    <span className="text-[10px] text-emerald-600 font-bold font-mono">100% Backed</span>
                  </div>
                  <span className="text-3xl font-extralight text-[#131313] tracking-tight block font-mono">
                    ₹4,12,000
                  </span>
                  <span className="text-[10px] text-[#888] font-mono">.00 INR IN VAULTS</span>
                </div>
                <div className="pt-3">
                  <div className="text-[10px] text-[#888] font-mono flex items-center justify-between">
                    <span>Multi-Sig Treasury Vault</span>
                    <span className="text-[#131313] font-bold">Cold Secure</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. LOWER DARK COMMAND CENTER (PROVIDERS & INGRESS STREAM) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: API Providers Status (5 cols) */}
          <div className="lg:col-span-5 bg-[#1c1b1b]/80 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#DBEF90]" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                  Upstream API Providers
                </h2>
              </div>
              <Link href="/admin/providers" className="text-xs text-[#DBEF90] hover:underline">
                Manage Providers
              </Link>
            </div>

            <div className="space-y-3">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="bg-surface-container-high/40 border border-white/5 rounded-2xl p-4 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{p.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono text-[10px]">
                      {p.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-mono text-[11px] text-on-surface-variant">
                    <span>Balance: ${p.balance.toFixed(2)} USD</span>
                    <span>{p.serviceCount} Services</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] font-mono">
                    <span className="text-on-surface-variant">Last sync: {new Date(p.lastSyncAt).toLocaleTimeString()}</span>
                    <button
                      onClick={() => handleSync(p.id)}
                      disabled={syncingId === p.id}
                      className="text-[#DBEF90] hover:underline inline-flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${syncingId === p.id ? "animate-spin" : ""}`} />
                      <span>Sync</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Global Orders Control Table (7 cols) */}
          <div className="lg:col-span-7 bg-[#1c1b1b]/80 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#DBEF90]" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                  Real-Time Orders Ingress
                </h2>
              </div>
              <Link href="/admin/orders" className="text-xs text-[#DBEF90] hover:underline">
                View All {orders.length} Orders
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase font-mono text-on-surface-variant">
                    <th className="py-2.5 px-2">Order ID</th>
                    <th className="py-2.5 px-2">Service</th>
                    <th className="py-2.5 px-2">Quantity</th>
                    <th className="py-2.5 px-2">Status</th>
                    <th className="py-2.5 px-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.slice(0, 6).map((o) => (
                    <tr key={o.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-2 font-mono font-bold text-white whitespace-nowrap">
                        {o.id}
                      </td>
                      <td className="py-3 px-2 max-w-[180px] truncate text-white">
                        {o.serviceName}
                      </td>
                      <td className="py-3 px-2 font-mono text-on-surface-variant">
                        {o.quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-white/10 text-white font-semibold">
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {o.status !== "COMPLETED" && (
                            <button
                              onClick={() => updateOrderStatus(o.id, "COMPLETED")}
                              className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold"
                            >
                              Complete
                            </button>
                          )}
                          {o.status !== "CANCELLED" && (
                            <button
                              onClick={() => updateOrderStatus(o.id, "CANCELLED")}
                              className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
