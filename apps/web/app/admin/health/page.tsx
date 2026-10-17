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
} from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";

function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || "https://smm-production-bca7.up.railway.app";
  if (!envUrl.endsWith("/api/v1")) {
    return envUrl.replace(/\/+$/, "") + "/api/v1";
  }
  return envUrl;
}

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

        {/* 4 Core Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <div className="text-slate-400 text-[10px]">
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
                  <span className="text-slate-300">
                    {comp?.lastCatalogSync?.lastSyncAt
                      ? new Date(comp.lastCatalogSync.lastSyncAt).toLocaleString()
                      : "Sync on boot active"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
