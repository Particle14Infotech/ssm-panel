"use client";


import React, { useState, useEffect } from "react";
import {
  Activity,
  Database,
  Server,
  Zap,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ShieldCheck,
  Send,
  Cpu,
  Mail,
} from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { getApiBase } from "@/lib/api-base";

const API_BASE = getApiBase();

export default function AdminSystemHealthPage() {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  const fetchHealth = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/health/system`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch {
      // Offline fallback
    } finally {
      setIsLoading(false);
      setLastRefreshed(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const comp = telemetry?.components;

  return (
    <div className="w-full bg-transparent min-h-screen pb-24 text-slate-100">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Header Telemetry */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#D8EC8D]">
              <span className="w-2 h-2 rounded-full bg-[#D8EC8D] animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                Platform Diagnostics & Runtime Monitor
              </span>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight">System Health Supervisor</h1>
            <p className="text-xs text-slate-400">
              Live operational health probes across PostgreSQL, Redis BullMQ broker, Outbox Daemon, and Upstream Gateways.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400">
              Last check: {lastRefreshed || "Checking..."}
            </span>
            <button
              onClick={fetchHealth}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-[#D8EC8D]/40 text-xs font-mono text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#D8EC8D] ${isLoading ? "animate-spin" : ""}`} />
              <span>{isLoading ? "Probing..." : "Refresh Probes"}</span>
            </button>
          </div>
        </div>

        {/* Global Cluster Status Banner */}
        <div className={`p-4 rounded-3xl border flex items-center justify-between ${
          telemetry?.status === "HEALTHY"
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
            : "bg-amber-500/10 border-amber-500/20 text-amber-300"
        }`}>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <div>
              <div className="text-sm font-bold text-white">
                Cluster Status: {telemetry?.status || "ANALYZING..."}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                All production services telemetry stream is auto-refreshed every 10 seconds.
              </div>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/10 text-white">
            {telemetry?.status || "STANDBY"}
          </span>
        </div>

        {/* 6 Core Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* 1. Database */}
          <div className="glass-panel rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Database className="w-4 h-4 text-[#D8EC8D]" />
                <span>PostgreSQL DB</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                comp?.database?.status === "CONNECTED"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-red-500/20 text-red-300"
              }`}>
                {comp?.database?.status || "DISCONNECTED"}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              <div>Connection Pool: Prisma Active</div>
              <div className="mt-1">Latency: ~{comp?.database?.latencyMs ?? 5}ms</div>
            </div>
          </div>

          {/* 2. Redis */}
          <div className="glass-panel rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Zap className="w-4 h-4 text-[#D8EC8D]" />
                <span>Redis Store</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                comp?.redis?.status === "CONNECTED"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-amber-500/20 text-amber-300"
              }`}>
                {comp?.redis?.status || "STANDBY"}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              <div>Queue Engine: BullMQ smm-orders</div>
              <div className="mt-1">Policy: noeviction</div>
            </div>
          </div>

          {/* 3. Background Worker */}
          <div className="glass-panel rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Cpu className="w-4 h-4 text-[#D8EC8D]" />
                <span>Background Worker</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                comp?.worker?.status === "RUNNING"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-white/10 text-slate-300"
              }`}>
                {comp?.worker?.status || "STANDBY"}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              <div>Heartbeat: {comp?.worker?.lastActivityAt ? new Date(comp.worker.lastActivityAt).toLocaleTimeString() : "Active"}</div>
              <div className="mt-1">Cycle: 2s poll / 8s sync</div>
            </div>
          </div>

          {/* 4. Outbox Relay */}
          <div className="glass-panel rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Send className="w-4 h-4 text-[#D8EC8D]" />
                <span>Outbox Queue</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                (comp?.outbox?.failedCount ?? 0) === 0
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-red-500/20 text-red-300"
              }`}>
                {comp?.outbox?.failedCount ?? 0} Failed
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              <div>Pending Depth: {comp?.outbox?.pendingDepth ?? 0} events</div>
              <div className="mt-1">Skip-Locked Polling: Active</div>
            </div>
          </div>

          {/* 5. Transactional Email */}
          <div className="glass-panel rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Mail className="w-4 h-4 text-[#D8EC8D]" />
                <span>Transactional Email</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                (comp?.email?.failedToday ?? 0) === 0
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-red-500/20 text-red-300"
              }`}>
                {comp?.email?.dailyLimit ? `${comp.email.sentToday}/${comp.email.dailyLimit} Sent` : "Active"}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              <div>Provider: {comp?.email?.provider || "Resend HTTPS API"}</div>
              <div className="mt-1">
                Queue: {comp?.email?.pendingCount ?? 0} pend • {comp?.email?.suppressedCount ?? 0} supr
              </div>
            </div>
          </div>

          {/* 6. Drip-Feed Supervisor */}
          <div className="glass-panel rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Clock className="w-4 h-4 text-[#D8EC8D]" />
                <span>Drip Supervisor</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                (comp?.dripFeed?.lateRuns ?? 0) === 0 && (comp?.dripFeed?.uncertainRuns ?? 0) === 0
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-amber-500/20 text-amber-300"
              }`}>
                {comp?.dripFeed?.dueRuns ?? 0} Due
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono space-y-0.5">
              <div>Late (&gt;10m): <span className={comp?.dripFeed?.lateRuns ? "text-amber-400 font-bold" : "text-white"}>{comp?.dripFeed?.lateRuns ?? 0}</span></div>
              <div>Uncertain: <span className={comp?.dripFeed?.uncertainRuns ? "text-purple-400 font-bold" : "text-white"}>{comp?.dripFeed?.uncertainRuns ?? 0}</span></div>
              <div>Failed: <span className={comp?.dripFeed?.failedRuns ? "text-rose-400 font-bold" : "text-white"}>{comp?.dripFeed?.failedRuns ?? 0}</span></div>
            </div>
          </div>
        </div>

        {/* Detailed Operational Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Provider Nodes Status */}
          <div className="glass-panel rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#D8EC8D]" />
                <h3 className="text-sm font-semibold text-white">Upstream Providers Telemetry</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {comp?.providers?.length || 0} Connected
              </span>
            </div>

            <div className="space-y-3">
              {comp?.providers?.map((p: any) => (
                <div key={p.id} className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{p.name}</span>
                    <span className="text-[#D8EC8D] font-bold">
                      ₹{p.balance.toFixed(2)} {p.currency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Catalog Services: {p.serviceCount} active</span>
                    <span>Last checked: {new Date(p.lastCheckedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Last Order Dispatch & Catalog Sync Telemetry */}
          <div className="glass-panel rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#D8EC8D]" />
                <h3 className="text-sm font-semibold text-white">Execution Supervisors</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Live Probes</span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                <div className="text-slate-400 text-[10px] uppercase font-semibold">Last Order Dispatched</div>
                {comp?.lastDispatch ? (
                  <div className="text-white space-y-0.5">
                    <div>Order #{comp.lastDispatch.orderId}</div>
                    <div className="text-slate-400 text-[11px]">
                      Status: <span className="text-[#D8EC8D]">{comp.lastDispatch.status}</span> • Ref: {comp.lastDispatch.providerOrderId || "simulated"}
                    </div>
                    <div className="text-slate-400 text-[10px]" suppressHydrationWarning>
                      Dispatched: {new Date(comp.lastDispatch.timestamp).toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 italic">No orders dispatched in this session</div>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                <div className="text-slate-400 text-[10px] uppercase font-semibold">Catalog Sync Supervisor</div>
                <div className="text-white">
                  Last Catalog Sync:{" "}
                  <span className="text-slate-300" suppressHydrationWarning>
                    {comp?.lastCatalogSync?.lastSyncAt
                      ? new Date(comp.lastCatalogSync.lastSyncAt).toLocaleString()
                      : "Sync on boot active"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Transactional Email & Delivery Telemetry */}
          <div className="glass-panel rounded-3xl p-6 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#D8EC8D]" />
                <h3 className="text-sm font-semibold text-white">Transactional Email Delivery Supervisor (Resend HTTPS API)</h3>
              </div>
              <span className="text-xs text-[#D8EC8D] font-mono">
                {comp?.email?.provider || "Resend Provider"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="text-slate-400 text-[10px] uppercase font-semibold">Daily Quota (Free Plan 100/day)</div>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold text-white">{comp?.email?.sentToday ?? 0}</span>
                  <span className="text-slate-400">/ {comp?.email?.dailyLimit ?? 100} limit</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      (comp?.email?.sentToday ?? 0) >= 80 ? "bg-amber-400" : "bg-[#D8EC8D]"
                    }`}
                    style={{ width: `${Math.min(100, ((comp?.email?.sentToday ?? 0) / (comp?.email?.dailyLimit ?? 100)) * 100)}%` }}
                  />
                </div>
                {(comp?.email?.sentToday ?? 0) >= 80 && (
                  <div className="text-amber-400 text-[10px]">Warning: 80% quota threshold reached</div>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="text-slate-400 text-[10px] uppercase font-semibold">Queue & Suppression Metrics</div>
                <div className="text-slate-300 space-y-1">
                  <div>Pending in Queue: <span className="text-white font-bold">{comp?.email?.pendingCount ?? 0}</span></div>
                  <div>Failed Today: <span className={(comp?.email?.failedToday ?? 0) > 0 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>{comp?.email?.failedToday ?? 0}</span></div>
                  <div>Suppression List: <span className="text-white font-bold">{comp?.email?.suppressedCount ?? 0}</span> addresses</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="text-slate-400 text-[10px] uppercase font-semibold">Last Email Dispatched</div>
                {comp?.email?.lastDispatch ? (
                  <div className="text-slate-300 space-y-0.5 text-[11px]">
                    <div className="text-white font-bold truncate">To: {comp.email.lastDispatch.to}</div>
                    <div>Type: <span className="text-[#D8EC8D]">{comp.email.lastDispatch.type}</span></div>
                    <div>Status: <span className={comp.email.lastDispatch.status === "SENT" || comp.email.lastDispatch.status === "DELIVERED" ? "text-emerald-400" : "text-amber-400"}>{comp.email.lastDispatch.status}</span></div>
                    {comp.email.lastDispatch.providerMessageId && (
                      <div className="text-[10px] text-slate-400 truncate">MsgId: {comp.email.lastDispatch.providerMessageId}</div>
                    )}
                    {comp.email.lastDispatch.error && (
                      <div className="text-[10px] text-red-400 truncate">Err: {comp.email.lastDispatch.error}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-400 italic">No email dispatches recorded</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
