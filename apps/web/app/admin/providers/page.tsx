"use client";

import React, { useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import {
  Server,
  PlusCircle,
  RefreshCw,
  DownloadCloud,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Key,
  Globe,
  Database,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export default function AdminProvidersPage() {
  const { providers, addProvider, syncProvider, importFromProvider } = useAdmin();
  const [isAdding, setIsAdding] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // New Provider Form
  const [name, setName] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [marginPercent, setMarginPercent] = useState<number>(20);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !apiUrl.trim() || !apiKey.trim()) return;

    await addProvider({
      name: name.trim(),
      apiUrl: apiUrl.trim(),
      apiKey: apiKey.trim(),
    });
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

  const handleImport = async (id: string) => {
    setImportingId(id);
    setImportNotice(null);
    const res = await importFromProvider(id, marginPercent);
    setImportingId(null);
    if (res.success) {
      setImportNotice(`Successfully imported/synced ${res.importedCount ?? 0} services with ${marginPercent}% margin.`);
      setTimeout(() => setImportNotice(null), 5000);
    } else {
      setImportNotice("Failed to import services from upstream provider.");
      setTimeout(() => setImportNotice(null), 5000);
    }
  };

  return (
    <div className="w-full bg-transparent min-h-screen pb-24 text-on-surface">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Header Telemetry */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                Upstream Provider Aggregator / API Balance Telemetry
              </span>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight">API Providers</h1>
            <p className="text-xs text-slate-400">
              Manage upstream SMM service wholesalers, real-time balance monitors, and automated catalog syncing.
            </p>
          </div>

          <button
            onClick={() => setIsAdding(true)}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-bold hover:brightness-110 flex items-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.3)] shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Connect New Provider</span>
          </button>
        </div>

        {/* Global Import Notice */}
        {importNotice && (
          <div className="p-4 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-400" />
              <span>{importNotice}</span>
            </div>
            <button
              onClick={() => setImportNotice(null)}
              className="text-blue-200 hover:text-white p-1 rounded-md"
              aria-label="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Add Provider Modal */}
        {isAdding && (
          <form
            onSubmit={handleCreate}
            className="bg-[#070B16] border border-white/10 rounded-3xl p-6 md:p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-semibold text-white">Connect Upstream SMM Provider</h3>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                  Provider Name / Label
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. ApexSMM Primary API"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                  API Endpoint URL
                </label>
                <input
                  type="url"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://provider.com/api/v2"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                  API Secret Key (Stored Encrypted)
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_live_..."
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                className="px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md"
              >
                Verify & Connect Node
              </button>
            </div>
          </form>
        )}

        {/* Margin setting bar */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-[#070B16] border border-white/10 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span>Global Selling Rate Formula:</span>
            <span className="font-mono text-blue-400 font-semibold">Selling Rate = Provider Cost + Margin %</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-400 font-mono">Import Margin %:</label>
            <input
              type="number"
              min={0}
              max={500}
              value={marginPercent}
              onChange={(e) => setMarginPercent(Number(e.target.value))}
              className="w-20 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-white font-mono text-xs"
            />
          </div>
        </div>

        {/* Providers Grid or Empty State */}
        {providers.length === 0 ? (
          <EmptyState
            icon={Server}
            title="No Upstream Providers Configured"
            description="Connect an external SMM provider node to import services and route automated orders."
            actionText="Connect First Provider"
            onActionClick={() => setIsAdding(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {providers.map((p) => (
              <div
                key={p.id}
                className="bg-[#070B16] border border-white/10 rounded-3xl p-6 hover:border-blue-500/40 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] space-y-4 flex flex-col justify-between transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] font-mono uppercase text-slate-400">
                      {p.id}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                      {p.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white">{p.name}</h3>

                  <div className="bg-white/[0.03] rounded-2xl p-3.5 space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Account Balance</span>
                      <span className="text-blue-400 font-bold text-sm">
                        ₹{p.balance.toFixed(2)} {p.currency}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Mapped Services</span>
                      <span className="text-white font-bold">{p.serviceCount} items</span>
                    </div>
                    <div className="flex justify-between text-slate-400 truncate">
                      <span>API Endpoint</span>
                      <span className="text-white truncate max-w-[140px]">{p.apiUrl}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Secret Key</span>
                      <span className="text-white font-mono text-[11px]">
                        {p.apiKey || "••••••••"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                  <button
                    onClick={() => handleImport(p.id)}
                    disabled={importingId === p.id}
                    className="px-3 py-1 rounded-full bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-semibold transition-all inline-flex items-center gap-1.5 border border-blue-500/30"
                  >
                    <DownloadCloud className={`w-3.5 h-3.5 ${importingId === p.id ? "animate-bounce" : ""}`} />
                    <span>{importingId === p.id ? "Importing..." : "Import Catalog"}</span>
                  </button>

                  <button
                    onClick={() => handleSync(p.id)}
                    disabled={syncingId === p.id}
                    className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingId === p.id ? "animate-spin" : ""}`} />
                    <span>Sync Balance</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
