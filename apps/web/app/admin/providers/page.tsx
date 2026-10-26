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
  Edit3,
  Trash2,
  X,
  Check,
  Percent,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminProvider } from "@/content/admin-data";

export default function AdminProvidersPage() {
  const { providers, addProvider, updateProvider, deleteProvider, syncProvider, importFromProvider, applyBulkMargin } = useAdmin();
  const [isAdding, setIsAdding] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AdminProvider | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [applyingMargin, setApplyingMargin] = useState(false);
  const [applyingProviderId, setApplyingProviderId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // New Provider Form
  const [name, setName] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [marginPercent, setMarginPercent] = useState<number>(20);

  // Edit Provider Form
  const [editName, setEditName] = useState("");
  const [editApiUrl, setEditApiUrl] = useState("");
  const [editApiKey, setEditApiKey] = useState("");
  const [editActive, setEditActive] = useState(true);

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
    setImportNotice("Provider connected successfully.");
    setTimeout(() => setImportNotice(null), 4000);
  };

  const handleStartEdit = (p: AdminProvider) => {
    setEditingProvider(p);
    setEditName(p.name);
    setEditApiUrl(p.apiUrl);
    setEditApiKey("");
    setEditActive(p.status === "CONNECTED");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider || !editName.trim() || !editApiUrl.trim()) return;

    await updateProvider(editingProvider.id, {
      name: editName.trim(),
      apiUrl: editApiUrl.trim(),
      apiKey: editApiKey.trim() ? editApiKey.trim() : undefined,
      active: editActive,
    });
    setEditingProvider(null);
    setImportNotice(`Provider #${editingProvider.id} updated successfully.`);
    setTimeout(() => setImportNotice(null), 4000);
  };

  const handleDeleteConfirm = async (id: string) => {
    await deleteProvider(id);
    setDeletingId(null);
    setImportNotice(`Provider #${id} deleted.`);
    setTimeout(() => setImportNotice(null), 4000);
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    setImportNotice(null);
    const success = await syncProvider(id);
    setSyncingId(null);
    if (success) {
      setImportNotice(`Provider #${id} balance and telemetry successfully refreshed.`);
    } else {
      setImportNotice(`Failed to sync provider #${id}. Verify upstream API connectivity and secret key.`);
    }
    setTimeout(() => setImportNotice(null), 5000);
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

  const handleApplyGlobalMargin = async () => {
    setApplyingMargin(true);
    setImportNotice(null);
    const res = await applyBulkMargin({ marginPercent });
    setApplyingMargin(false);
    if (res.success) {
      setImportNotice(res.message || `Applied +${marginPercent}% margin to all catalog services.`);
    } else {
      setImportNotice(res.message || "Failed to apply margin.");
    }
    setTimeout(() => setImportNotice(null), 5000);
  };

  const handleApplyProviderMargin = async (providerId: string) => {
    setApplyingProviderId(providerId);
    setImportNotice(null);
    const res = await applyBulkMargin({ providerId, marginPercent });
    setApplyingProviderId(null);
    if (res.success) {
      setImportNotice(res.message || `Applied +${marginPercent}% margin to mapped services.`);
    } else {
      setImportNotice(res.message || "Failed to apply margin to provider services.");
    }
    setTimeout(() => setImportNotice(null), 5000);
  };

  return (
    <div className="w-full bg-transparent min-h-screen pb-24 text-on-surface">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Header Telemetry */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#D8EC8D]">
              <span className="w-2 h-2 rounded-full bg-[#D8EC8D] animate-pulse" />
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
            className="px-5 py-2.5 rounded-full btn-primary-gradient text-[#171e00] text-xs font-bold hover:brightness-110 flex items-center gap-2 shadow-[0_0_20px_rgba(216,236,141,0.25)] shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Connect New Provider</span>
          </button>
        </div>

        {/* Global Import Notice */}
        {importNotice && (
          <div className="p-4 rounded-2xl bg-[#D8EC8D]/15 border border-[#D8EC8D]/30 text-[#D8EC8D] text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#D8EC8D]" />
              <span>{importNotice}</span>
            </div>
            <button
              onClick={() => setImportNotice(null)}
              className="text-[#D8EC8D]/80 hover:text-white p-1 rounded-md"
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
            className="bg-[#131313] border border-white/10 rounded-3xl p-6 md:p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] space-y-4"
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
                  placeholder="e.g. cheapestsmmpanels"
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
                  placeholder="https://cheapestsmmpanels.com/api/v2"
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
                  placeholder="Enter secret API key..."
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 rounded-full btn-primary-gradient text-[#171e00] text-xs font-bold transition-all shadow-md"
              >
                Verify & Connect Node
              </button>
            </div>
          </form>
        )}

        {/* Edit Provider Modal */}
        {editingProvider && (
          <form
            onSubmit={handleSaveEdit}
            className="bg-[#131313] border border-[#D8EC8D]/30 rounded-3xl p-6 md:p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#D8EC8D]" />
                <h3 className="text-base font-semibold text-white">Modify Provider Node #{editingProvider.id}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingProvider(null)}
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
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
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
                  value={editApiUrl}
                  onChange={(e) => setEditApiUrl(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                  New API Key (Leave empty to keep existing)
                </label>
                <input
                  type="password"
                  value={editApiKey}
                  onChange={(e) => setEditApiKey(e.target.value)}
                  placeholder="Leave blank to preserve key"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="w-4 h-4 rounded bg-white/5 border-white/10 accent-[#D8EC8D]"
                />
                <span>Active Provider (Enable automatic routing)</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingProvider(null)}
                className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 rounded-full btn-primary-gradient text-[#171e00] text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        )}

        {/* Delete Confirmation Modal */}
        {deletingId && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 space-y-4 text-xs">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <h4 className="font-bold text-white text-sm">Delete Provider Node #{deletingId}?</h4>
                <p className="text-slate-400 text-xs">
                  This action removes the API credentials from the platform. Any linked services will be unlinked.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConfirm(deletingId)}
                className="px-4 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-md"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}

        {/* Margin setting bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl bg-[#131313] border border-white/10 text-xs gap-3">
          <div className="flex items-center gap-2 text-slate-300">
            <span>Selling Rate Formula:</span>
            <span className="font-mono text-[#D8EC8D] font-semibold">Selling Rate = Provider Cost + Margin %</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-slate-400 font-mono">Catalog Margin %:</label>
              <input
                type="number"
                min={0}
                max={500}
                value={marginPercent}
                onChange={(e) => setMarginPercent(Number(e.target.value))}
                className="w-20 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-white font-mono text-xs"
              />
            </div>
            <button
              onClick={handleApplyGlobalMargin}
              disabled={applyingMargin}
              className="px-3.5 py-1.5 rounded-full btn-primary-gradient text-[#171e00] font-bold text-xs hover:brightness-105 transition-all inline-flex items-center gap-1.5 shadow-sm"
              title="Apply this margin % to all services across all providers immediately"
            >
              <Percent className="w-3.5 h-3.5" />
              <span>{applyingMargin ? "Applying..." : `Apply ${marginPercent}% to All Services`}</span>
            </button>
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
                className="bg-[#1c1b1b] border border-white/10 rounded-3xl p-6 hover:border-[#D8EC8D]/40 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] space-y-4 flex flex-col justify-between transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] font-mono uppercase text-slate-400">
                      {p.id}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
                          p.status === "CONNECTED"
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-red-500/15 text-red-300 border-red-500/30"
                        }`}
                      >
                        {p.status}
                      </span>
                      <button
                        onClick={() => handleStartEdit(p)}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
                        title="Edit provider"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingId(p.id)}
                        className="p-1 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-300 hover:text-red-400 transition-all"
                        title="Delete provider"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-white">{p.name}</h3>

                  <div className="bg-white/[0.03] rounded-2xl p-3.5 space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Account Balance</span>
                      <span className="text-[#D8EC8D] font-bold text-sm">
                        ₹{p.balance.toFixed(2)} {p.currency}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Mapped Services</span>
                      <span className="text-white font-bold">{p.serviceCount} items</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Order status API health</span>
                      <span
                        className={`font-bold ${
                          p.healthStatus === "HEALTHY"
                            ? "text-emerald-300"
                            : p.healthStatus === "DEGRADED"
                              ? "text-rose-300"
                              : "text-slate-300"
                        }`}
                      >
                        {p.healthStatus || "UNKNOWN"}
                        {!!p.consecutiveStatusFailures &&
                          ` (${p.consecutiveStatusFailures} consecutive failures)`}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Last order status check</span>
                      <span className="text-slate-300 font-mono text-[10px]" suppressHydrationWarning>
                        {p.lastStatusCheckAt
                          ? new Date(p.lastStatusCheckAt).toLocaleString()
                          : "No recent checks"}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Drip / Refill / Cancel</span>
                      <span className="text-[#D8EC8D] font-bold">
                        {p.dripFeedCount ?? 0} / {p.refillCount ?? 0} / {p.cancelCount ?? 0}
                      </span>
                    </div>
                    {p.lastSyncAt && (
                      <div className="flex justify-between text-slate-400">
                        <span>Last Synced</span>
                        <span className="text-slate-300 font-mono text-[10px]" suppressHydrationWarning>
                          {new Date(p.lastSyncAt).toLocaleString()}
                        </span>
                      </div>
                    )}
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

                <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleImport(p.id)}
                      disabled={importingId === p.id}
                      className="px-3 py-1 rounded-full bg-[#D8EC8D]/15 hover:bg-[#D8EC8D] text-[#D8EC8D] hover:text-[#171e00] text-xs font-bold transition-all inline-flex items-center gap-1.5 border border-[#D8EC8D]/30"
                      title="Fetch latest services from upstream API"
                    >
                      <DownloadCloud className={`w-3.5 h-3.5 ${importingId === p.id ? "animate-bounce" : ""}`} />
                      <span>{importingId === p.id ? "Importing..." : "Import"}</span>
                    </button>

                    <button
                      onClick={() => handleApplyProviderMargin(p.id)}
                      disabled={applyingProviderId === p.id}
                      className="px-3 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-black text-xs font-bold transition-all inline-flex items-center gap-1.5 border border-emerald-500/30"
                      title={`Recalculate selling rates for this provider's services with +${marginPercent}% margin`}
                    >
                      <Percent className="w-3.5 h-3.5" />
                      <span>{applyingProviderId === p.id ? "Applying..." : `Apply +${marginPercent}%`}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleSync(p.id)}
                    disabled={syncingId === p.id}
                    className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                    title="Refresh live wallet balance"
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
