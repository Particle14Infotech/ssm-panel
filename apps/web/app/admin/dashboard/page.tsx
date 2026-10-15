"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAdmin } from "@/context/AdminContext";
import {
  TrendingUp,
  Activity,
  Users,
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
} from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";

export default function AdminDashboardPage() {
  const { users, services, orders, providers, transactions, syncProvider, updateOrderStatus } = useAdmin();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Real calculations only — no hardcoded placeholder amounts
  const totalRevenue = orders.reduce((acc, o) => acc + (o.charge || 0), 0);
  const upstreamCost = Math.round(totalRevenue * 0.65);
  const netProfit = totalRevenue - upstreamCost;
  const customerBalances = users.reduce((acc, u) => acc + (u.balance || 0), 0);
  const activeOrdersCount = orders.filter((o) => o.status === "IN_PROGRESS" || o.status === "PROCESSING").length;

  const handleSync = async (providerId: string) => {
    setSyncingId(providerId);
    await syncProvider(providerId);
    setTimeout(() => setSyncingId(null), 800);
  };

  return (
    <div className="w-full bg-[#02040A] min-h-screen pb-24 text-slate-100">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-6 space-y-8">
        {/* Header Telemetry */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                Administrative Control Matrix
              </span>
            </div>
            <h1 className="text-3xl font-semibold text-white tracking-tight">Admin Overview</h1>
            <p className="text-xs text-slate-400">
              Real-time platform metrics, upstream provider balances, and global order queues.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/services"
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 transition-all"
            >
              Services ({services.length})
            </Link>
            <Link
              href="/admin/providers"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all"
            >
              Providers ({providers.length})
            </Link>
          </div>
        </div>

        {/* 4 Core Operational Stat Cards (12-col grid, equal height) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Registered Users"
            value={users.length.toLocaleString()}
            subtitle="Scoped real database accounts"
            icon={Users}
          />
          <StatCard
            title="Total Platform Orders"
            value={orders.length.toLocaleString()}
            subtitle={`${activeOrdersCount} active in processing queue`}
            icon={Activity}
          />
          <StatCard
            title="Active Services"
            value={services.length.toLocaleString()}
            subtitle="Catalog offerings online"
            icon={Layers}
          />
          <StatCard
            title="Connected Providers"
            value={providers.length.toLocaleString()}
            subtitle="Upstream API dispatch hubs"
            icon={Server}
          />
        </div>

        {/* 4 Real Financial Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Gross Revenue"
            value={`₹${totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            subtitle="Real order volume cleared"
            icon={TrendingUp}
            highlight={true}
          />
          <StatCard
            title="Estimated Upstream Cost"
            value={`₹${upstreamCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            subtitle="Approx. 65% provider baseline"
            icon={Server}
          />
          <StatCard
            title="Net Margin (Yield)"
            value={`₹${netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            subtitle="Estimated net surplus"
            icon={Sparkles}
          />
          <StatCard
            title="Total Customer Vault"
            value={`₹${customerBalances.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            subtitle="Backed wallet liquidity"
            icon={Shield}
          />
        </div>

        {/* 2-Column Split: Upstream Providers Status (5 cols) & Recent Platform Orders (7 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Providers Status (5 cols) */}
          <GlassCard className="lg:col-span-5 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                  Upstream API Providers
                </h2>
              </div>
              <Link href="/admin/providers" className="text-xs text-blue-400 hover:underline">
                Manage All
              </Link>
            </div>

            {providers.length === 0 ? (
              <EmptyState
                icon={Server}
                title="No providers configured"
                description="Add an external SMM provider to import catalog services and enable automated fulfillment."
                actionText="Add Provider"
                actionHref="/admin/providers"
              />
            ) : (
              <div className="space-y-3">
                {providers.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-white">{p.name}</div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {p.status || "ACTIVE"}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 truncate">
                      {p.apiUrl}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 font-mono text-[11px]">
                      <div>
                        <span className="text-slate-400">Balance: </span>
                        <span className="text-white font-semibold">
                          ₹{p.balance ? p.balance.toFixed(2) : "0.00"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSync(p.id)}
                        disabled={syncingId === p.id}
                        className="px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-[10px] font-semibold transition-all flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${syncingId === p.id ? "animate-spin" : ""}`} />
                        <span>{syncingId === p.id ? "Syncing..." : "Sync Balance"}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Right: Recent Global Orders (7 cols) */}
          <GlassCard className="lg:col-span-7 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                  Global Orders Dispatch Queue
                </h2>
              </div>
              <Link href="/admin/orders" className="text-xs text-blue-400 hover:underline">
                View All ({orders.length})
              </Link>
            </div>

            {orders.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No orders yet"
                description="Orders placed across the entire platform will appear in this real-time stream."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">Service</th>
                      <th className="py-2.5 px-3">Qty</th>
                      <th className="py-2.5 px-3">Charge</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {orders.slice(0, 8).map((o) => (
                      <tr key={o.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-3 font-mono font-semibold text-white whitespace-nowrap">
                          #{o.id}
                        </td>
                        <td className="py-3 px-3 max-w-[180px] truncate text-slate-300">
                          {o.serviceName}
                        </td>
                        <td className="py-3 px-3 font-mono text-white">
                          {o.quantity.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-white">
                          ₹{o.charge.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <StatusBadge status={o.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
