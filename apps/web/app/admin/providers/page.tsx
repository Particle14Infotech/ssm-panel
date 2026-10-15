"use client";

import React, { useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import { AdminProvider } from "@/content/admin-data";
import {
  Server,
  PlusCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Key,
  Globe,
  Database,
} from "lucide-react";

export default function AdminProvidersPage() {
  const { providers, addProvider, syncProvider } = useAdmin();
  const [isAdding, setIsAdding] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // New Provider Form
  const [name, setName] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !apiUrl.trim() || !apiKey.trim()) return;

    const newP: AdminProvider = {
      id: `prov_${Math.random().toString(36).substring(2, 8)}`,
      name: name.trim(),
      apiUrl: apiUrl.trim(),
      apiKey: apiKey.trim(),
      balance: 1000.0,
      currency: "USD",
      status: "CONNECTED",
      serviceCount: 100,
      lastSyncAt: new Date().toISOString(),
    };

    addProvider(newP);
    setIsAdding(false);
    setName("");
    setApiUrl("");
    setApiKey("");
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    await syncProvider(id);
    setTimeout(() => setSyncingId(null), 800);
  };

  return (
    <div className="w-full bg-transparent min-h-screen pb-24 text-on-surface">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Header Telemetry */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#DBEF90]">
              <span className="w-2 h-2 rounded-full bg-[#DBEF90] animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                Upstream Provider Aggregator / API Balance Telemetry
              </span>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight">API Providers</h1>
            <p className="text-xs text-on-surface-variant">
              Manage upstream SMM service wholesalers, real-time balance monitors, and automated catalog syncing.
            </p>
          </div>

          <button
            onClick={() => setIsAdding(true)}
            className="px-5 py-2.5 rounded-full bg-[#DBEF90] text-[#2a3400] text-xs font-bold hover:brightness-110 flex items-center gap-2 shadow-[0_0_20px_rgba(219,239,144,0.3)] shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Connect New Provider</span>
          </button>
        </div>

        {/* Add Provider Modal */}
        {isAdding && (
          <form
            onSubmit={handleCreate}
            className="glass-panel rounded-3xl p-6 md:p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-semibold text-white">Connect Upstream SMM Provider</h3>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-xs text-on-surface-variant hover:text-white"
              >
                ✕ Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Provider Name / Label
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. ApexSMM Primary API"
                  required
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  API Endpoint URL
                </label>
                <input
                  type="url"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://provider.com/api/v2"
                  required
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  API Secret Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_live_..."
                  required
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                className="px-6 py-2 rounded-full bg-[#DBEF90] text-[#2a3400] text-xs font-bold hover:brightness-110 shadow-md"
              >
                Verify & Connect Node
              </button>
            </div>
          </form>
        )}

        {/* Providers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {providers.map((p) => (
            <div
              key={p.id}
              className="glass-panel rounded-3xl p-6 hover:border-[#DBEF90]/40 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] space-y-4 flex flex-col justify-between transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-surface-container-high text-[10px] font-mono uppercase text-on-surface-variant">
                    {p.id}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                    {p.status}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-white">{p.name}</h3>

                <div className="bg-surface-container-high/40 rounded-2xl p-3.5 space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Account Balance</span>
                    <span className="text-[#DBEF90] font-bold text-sm">
                      ${p.balance.toFixed(2)} {p.currency}
                    </span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Mapped Services</span>
                    <span className="text-white font-bold">{p.serviceCount} items</span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant truncate">
                    <span>API Endpoint</span>
                    <span className="text-white truncate max-w-[140px]">{p.apiUrl}</span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Secret Key</span>
                    <span className="text-white font-mono text-[11px] truncate max-w-[140px]">
                      {p.apiKey ? (p.apiKey.startsWith("sk_live") ? p.apiKey.substring(0, 7) + "••••••••" : p.apiKey) : "sk_live_••••••••"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                <span className="text-on-surface-variant text-[10px]">
                  Sync: {new Date(p.lastSyncAt).toLocaleTimeString()}
                </span>
                <button
                  onClick={() => handleSync(p.id)}
                  disabled={syncingId === p.id}
                  className="px-3 py-1 rounded-full bg-white/5 hover:bg-[#DBEF90] text-white hover:text-[#2a3400] text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingId === p.id ? "animate-spin" : ""}`} />
                  <span>Sync Balance</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
