"use client";

import React, { useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import { ServiceItem, ServicePlatform } from "@smm/contracts";
import {
  Search,
  PlusCircle,
  Zap,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  DollarSign,
  TrendingUp,
  Percent,
  Check,
  X,
  Server,
  Sliders,
  ShieldAlert,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export default function AdminServicesPage() {
  const { services, providers, addService, updateService, deleteService } = useAdmin();
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Hybrid Routing Modal State
  const [routingService, setRoutingService] = useState<ServiceItem | null>(null);
  const [routeMode, setRouteMode] = useState<"MANUAL" | "AUTO_FAILOVER">("MANUAL");
  const [routePrimaryProviderId, setRoutePrimaryProviderId] = useState<string>("");
  const [routePrimaryServiceId, setRoutePrimaryServiceId] = useState<string>("");
  const [routeBackupProviderId, setRouteBackupProviderId] = useState<string>("");
  const [routeBackupServiceId, setRouteBackupServiceId] = useState<string>("");
  const [savingRouting, setSavingRouting] = useState<boolean>(false);

  // New Service State
  const [newId, setNewId] = useState<string>(`${Math.floor(8000 + Math.random() * 1000)}`);
  const [newName, setNewName] = useState<string>("");
  const [newPlatform, setNewPlatform] = useState<ServicePlatform>("INSTAGRAM");
  const [newCategory, setNewCategory] = useState<string>("Followers");
  const [newRate, setNewRate] = useState<number>(150);
  const [newMin, setNewMin] = useState<number>(100);
  const [newMax, setNewMax] = useState<number>(100000);
  const [newDescription, setNewDescription] = useState<string>("");
  const [newDripFeed, setNewDripFeed] = useState<boolean>(false);
  const [newProviderId, setNewProviderId] = useState<string>("");
  const [newProviderServiceId, setNewProviderServiceId] = useState<string>("");
  const [newRoutingMode, setNewRoutingMode] = useState<"MANUAL" | "AUTO_FAILOVER">("MANUAL");
  const [newBackupProviderId, setNewBackupProviderId] = useState<string>("");
  const [newBackupProviderServiceId, setNewBackupProviderServiceId] = useState<string>("");

  const openRoutingModal = (service: ServiceItem) => {
    setRoutingService(service);
    setRouteMode((service.routingMode as any) || "MANUAL");
    setRoutePrimaryProviderId(service.providerId || "");
    setRoutePrimaryServiceId(service.providerServiceId || "");
    setRouteBackupProviderId(service.backupProviderId || "");
    setRouteBackupServiceId(service.backupProviderServiceId || "");
  };

  const handleSaveRouting = async () => {
    if (!routingService) return;
    setSavingRouting(true);
    await updateService(routingService.id, {
      routingMode: routeMode,
      providerId: routePrimaryProviderId || null,
      providerServiceId: routePrimaryServiceId || null,
      backupProviderId: routeMode === "AUTO_FAILOVER" ? (routeBackupProviderId || null) : null,
      backupProviderServiceId: routeMode === "AUTO_FAILOVER" ? (routeBackupServiceId || null) : null,
    });
    setSavingRouting(false);
    setRoutingService(null);
  };

  const filteredServices = services.filter((s) => {
    const p = s.platform.toLowerCase().replace("_", "");
    const selectedP = selectedPlatform.toLowerCase().replace("_", "");
    const matchesPlatform = selectedPlatform === "ALL" || p === selectedP || (selectedP === "twitter" && p === "xtwitter");
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === "" ||
      s.id.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.categoryName.toLowerCase().includes(q);

    return matchesPlatform && matchesSearch;
  });

  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const created: ServiceItem = {
      id: newId,
      name: newName.trim(),
      categoryId: `cat_${newPlatform.toLowerCase()}`,
      categoryName: newCategory,
      platform: newPlatform,
      ratePer1000: newRate,
      minQty: newMin,
      maxQty: newMax,
      description: newDescription || "High-frequency algorithmic node distribution.",
      refillable: true,
      cancellable: true,
      avgStartTime: "Instant",
      avgProcessingSpeed: "50k / Day",
      status: "ACTIVE",
      badge: "Non-Drop",
      dripFeedSupported: newDripFeed,
      providerId: newProviderId || null,
      providerServiceId: newProviderServiceId || null,
      routingMode: newRoutingMode,
      backupProviderId: newRoutingMode === "AUTO_FAILOVER" ? (newBackupProviderId || null) : null,
      backupProviderServiceId: newRoutingMode === "AUTO_FAILOVER" ? (newBackupProviderServiceId || null) : null,
    };

    addService(created);
    setIsAdding(false);
    setNewName("");
    setNewDescription("");
    setNewId(`${Math.floor(8000 + Math.random() * 1000)}`);
    setNewProviderId("");
    setNewProviderServiceId("");
    setNewBackupProviderId("");
    setNewBackupProviderServiceId("");
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
                Service Matrix & Margin Multipliers
              </span>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight">Admin Service Directory</h1>
            <p className="text-xs text-on-surface-variant">
              Manage {services.length} catalog offerings, adjust retail rates per 1,000, and toggle active routing nodes.
            </p>
          </div>

          <button
            onClick={() => setIsAdding(true)}
            className="px-5 py-2.5 rounded-full btn-primary-gradient text-[#171e00] text-xs font-bold hover:brightness-110 flex items-center gap-2 shadow-[0_0_20px_rgba(216,236,141,0.25)] shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Catalog Service</span>
          </button>
        </div>

        {/* Create Service Modal / Drawer */}
        {isAdding && (
          <form
            onSubmit={handleCreateService}
            className="glass-panel rounded-3xl p-6 md:p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-semibold text-white">Create New Catalog Service</h3>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-xs text-on-surface-variant hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Service ID
                </label>
                <input
                  type="text"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Platform
                </label>
                <select
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value as ServicePlatform)}
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white"
                >
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="YOUTUBE">YouTube</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="TELEGRAM">Telegram</option>
                  <option value="X_TWITTER">X / Twitter</option>
                  <option value="SPOTIFY">Spotify</option>
                  <option value="LINKEDIN">LinkedIn</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Followers, Views, Likes"
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Rate per 1,000 (INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newRate}
                  onChange={(e) => setNewRate(Number(e.target.value))}
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Service Title
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Instagram High-Retention Non-Drop Followers"
                  required
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Min Qty
                </label>
                <input
                  type="number"
                  value={newMin}
                  onChange={(e) => setNewMin(Number(e.target.value))}
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Max Qty
                </label>
                <input
                  type="number"
                  value={newMax}
                  onChange={(e) => setNewMax(Number(e.target.value))}
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Service delivery parameters and node specifications..."
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Primary API Provider
                </label>
                <select
                  value={newProviderId}
                  onChange={(e) => setNewProviderId(e.target.value)}
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white"
                >
                  <option value="">Simulated / Internal Node</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Bal: ₹{p.balance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Primary Upstream Service ID
                </label>
                <input
                  type="text"
                  value={newProviderServiceId}
                  onChange={(e) => setNewProviderServiceId(e.target.value)}
                  placeholder="e.g. 1042"
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="sm:col-span-4 flex items-center gap-4 py-1">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="newModeManual"
                    name="newRoutingMode"
                    checked={newRoutingMode === "MANUAL"}
                    onChange={() => setNewRoutingMode("MANUAL")}
                    className="text-[#D8EC8D] focus:ring-[#D8EC8D]"
                  />
                  <label htmlFor="newModeManual" className="text-xs text-white cursor-pointer font-medium">
                    Manual Pinned Route
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="newModeAuto"
                    name="newRoutingMode"
                    checked={newRoutingMode === "AUTO_FAILOVER"}
                    onChange={() => setNewRoutingMode("AUTO_FAILOVER")}
                    className="text-cyan-400 focus:ring-cyan-400"
                  />
                  <label htmlFor="newModeAuto" className="text-xs text-cyan-300 cursor-pointer font-semibold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    Auto-Failover to Backup Provider
                  </label>
                </div>
              </div>

              {newRoutingMode === "AUTO_FAILOVER" && (
                <>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] uppercase font-mono text-cyan-400 block mb-1">
                      Backup / Fallback Provider
                    </label>
                    <select
                      value={newBackupProviderId}
                      onChange={(e) => setNewBackupProviderId(e.target.value)}
                      className="w-full bg-surface-container-highest border border-cyan-500/30 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="">Select Backup Provider</option>
                      {providers
                        .filter((p) => p.id !== newProviderId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Bal: ₹{p.balance.toFixed(2)})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] uppercase font-mono text-cyan-400 block mb-1">
                      Backup Upstream Service ID
                    </label>
                    <input
                      type="text"
                      value={newBackupProviderServiceId}
                      onChange={(e) => setNewBackupProviderServiceId(e.target.value)}
                      placeholder="e.g. 882"
                      className="w-full bg-surface-container-highest border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-mono"
                    />
                  </div>
                </>
              )}

              <div className="sm:col-span-4 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="newDripFeed"
                  checked={newDripFeed}
                  onChange={(e) => setNewDripFeed(e.target.checked)}
                  className="rounded border-white/20 bg-surface-container-highest text-[#D8EC8D] focus:ring-[#D8EC8D]"
                />
                <label htmlFor="newDripFeed" className="text-xs text-white cursor-pointer font-medium">
                  Support Provider-Native Drip-Feed Delivery
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                className="px-6 py-2 rounded-full btn-primary-gradient text-[#171e00] text-xs font-bold hover:brightness-110 shadow-md"
              >
                Save & Deploy Service
              </button>
            </div>
          </form>
        )}

        {/* Filter Controls */}
        <div className="glass-panel rounded-3xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services by ID, title, or category..."
              className="w-full bg-surface-container-highest/80 border border-white/5 focus:border-[#D8EC8D]/50 rounded-2xl pl-11 pr-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="bg-surface-container-highest/80 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white font-medium cursor-pointer"
            >
              <option value="ALL">All Platforms ({services.length})</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="tiktok">TikTok</option>
              <option value="telegram">Telegram</option>
              <option value="twitter">X / Twitter</option>
              <option value="spotify">Spotify</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>
        </div>

        {/* Services Table */}
        <div className="glass-panel rounded-3xl p-4 md:p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] overflow-hidden">
          {filteredServices.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={Zap}
                title={services.length === 0 ? "No services in catalog" : "No matching services"}
                description={
                  services.length === 0
                    ? "Your catalog has no active services. Create a service manually or import from a connected provider."
                    : "No services found matching your search or platform filter."
                }
                actionText="Add service / Import from provider"
                onActionClick={() => setIsAdding(true)}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase font-mono text-on-surface-variant">
                  <th className="py-3 px-3">ID</th>
                  <th className="py-3 px-3">Platform & Category</th>
                  <th className="py-3 px-3">Service Name</th>
                  <th className="py-3 px-3">Provider Cost</th>
                  <th className="py-3 px-3">Profit Margin</th>
                  <th className="py-3 px-3">Retail Rate / 1k</th>
                  <th className="py-3 px-3">Min / Max</th>
                  <th className="py-3 px-3">API Routing & Failover</th>
                  <th className="py-3 px-3">Drip-Feed</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredServices.map((service) => {
                  const isEditing = editingId === service.id;
                  const costVal = service.costINR ?? service.providerCostPer1k;
                  return (
                    <tr key={service.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-3 font-mono font-bold text-white whitespace-nowrap">
                        #{service.id}
                      </td>
                      <td className="py-4 px-3 font-mono text-on-surface-variant whitespace-nowrap">
                        <span className="text-white font-semibold">{service.platform}</span> • {service.categoryName}
                      </td>
                      <td className="py-4 px-3 font-medium text-white max-w-sm">
                        <div className="truncate">{service.name}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openRoutingModal(service)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono border transition-all hover:brightness-125 cursor-pointer bg-white/[0.03] border-white/10 text-slate-300"
                            title="Click to configure API provider & automatic failover"
                          >
                            {service.routingMode === "AUTO_FAILOVER" ? (
                              <span className="flex items-center gap-1 text-cyan-300">
                                <Zap className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
                                <span>Auto: {service.providerName || "P1"} ➔ {service.backupProviderName || "Backup"}</span>
                              </span>
                            ) : service.providerId ? (
                              <span className="flex items-center gap-1 text-slate-300">
                                <Server className="w-2.5 h-2.5 text-slate-400" />
                                <span>Manual: {service.providerName || "Assigned"}</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-300/80">
                                <span>⚪ Route API Provider</span>
                              </span>
                            )}
                            <Sliders className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-3 font-mono text-slate-400 whitespace-nowrap">
                        {costVal !== undefined && costVal !== null ? (
                          <span>₹{Number(costVal).toFixed(2)}</span>
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                      </td>
                      <td className="py-4 px-3 font-mono whitespace-nowrap">
                        {service.marginPercent !== undefined && service.marginPercent !== null ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#D8EC8D]/15 text-[#D8EC8D] border border-[#D8EC8D]/30">
                            +{service.marginPercent}%
                          </span>
                        ) : (
                          <span className="text-white/20 text-[10px] font-mono">Tiered</span>
                        )}
                      </td>
                      <td className="py-4 px-3 font-mono font-bold text-[#D8EC8D] whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={service.ratePer1000}
                            onBlur={(e) => {
                              updateService(service.id, { ratePer1000: Number(e.target.value) });
                              setEditingId(null);
                            }}
                            className="w-20 bg-black border border-[#D8EC8D] rounded px-2 py-0.5 text-white"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => setEditingId(service.id)}
                            className="hover:underline flex items-center gap-1"
                            title="Click to edit rate"
                          >
                            <span>₹{service.ratePer1000.toFixed(2)}</span>
                            <Edit className="w-2.5 h-2.5 opacity-60" />
                          </button>
                        )}
                      </td>
                      <td className="py-4 px-3 font-mono text-on-surface-variant whitespace-nowrap">
                        {service.minQty.toLocaleString()} – {service.maxQty.toLocaleString()}
                      </td>
                      <td className="py-4 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openRoutingModal(service)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-mono font-medium transition-all hover:brightness-125 border"
                          title="Click to configure API provider & automatic failover"
                        >
                          {service.routingMode === "AUTO_FAILOVER" ? (
                            <span className="flex items-center gap-1 text-cyan-300 bg-cyan-500/10 border-cyan-500/30 px-2 py-0.5 rounded-lg border">
                              <Zap className="w-3 h-3 text-cyan-400 animate-pulse" />
                              <span>Auto: {service.providerName || "P1"} ➔ {service.backupProviderName || "Backup"}</span>
                            </span>
                          ) : service.providerId ? (
                            <span className="flex items-center gap-1 text-slate-300 bg-white/5 border-white/10 px-2 py-0.5 rounded-lg border">
                              <Server className="w-3 h-3 text-slate-400" />
                              <span>Manual: {service.providerName || "Assigned"}</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-300/80 bg-amber-500/10 border-amber-500/20 px-2 py-0.5 rounded-lg border">
                              <span>Simulated / Internal</span>
                            </span>
                          )}
                          <Sliders className="w-3 h-3 opacity-60 ml-0.5" />
                        </button>
                      </td>
                      <td className="py-4 px-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold ${
                              service.dripFeedSupported
                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                : "bg-white/5 text-slate-500"
                            }`}
                          >
                            {service.dripFeedSupported ? "Native: ON" : "Native: OFF"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateService(service.id, {
                                allowManagedDrip: !service.allowManagedDrip,
                              })
                            }
                            className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold transition-all ${
                              service.allowManagedDrip
                                ? "bg-[#D8EC8D]/20 text-[#D8EC8D] border border-[#D8EC8D]/50"
                                : "bg-white/5 text-slate-400 border border-white/5 hover:text-white"
                            }`}
                            title="Click to toggle Panel-Managed Drip-Feed"
                          >
                            {service.allowManagedDrip ? "Managed: ALLOWED" : "Managed: OFF"}
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-3 whitespace-nowrap">
                        <button
                          onClick={() =>
                            updateService(service.id, {
                              status: service.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                            })
                          }
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            service.status === "ACTIVE"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {service.status}
                        </button>
                      </td>
                      <td className="py-4 px-3 text-right whitespace-nowrap flex items-center justify-end gap-1">
                        <button
                          onClick={() => openRoutingModal(service)}
                          className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                          title="Configure API Routing & Fallback"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete service #${service.id}?`)) {
                              deleteService(service.id);
                            }
                          }}
                          className="p-1.5 rounded-full hover:bg-rose-500/20 text-rose-400 transition-colors"
                          title="Delete Service"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hybrid API Routing & Fallback Drawer/Modal */}
      {routingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-xl rounded-3xl p-6 md:p-8 border border-white/10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.85)] space-y-6 relative">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-[#D8EC8D] mb-1">
                  <Server className="w-3.5 h-3.5" />
                  <span className="uppercase tracking-widest font-semibold">
                    API Provider Routing & Failover
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white">
                  #{routingService.id} • {routingService.name}
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Configure upstream provider nodes, package IDs, and automated fallback triggers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoutingService(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-mono text-on-surface-variant block">
                Routing Strategy
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRouteMode("MANUAL")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    routeMode === "MANUAL"
                      ? "bg-white/10 border-white/30 text-white shadow-lg"
                      : "bg-surface-container-highest/50 border-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                    <Server className="w-3.5 h-3.5 text-slate-300" />
                    <span>Manual Pinned Route</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Strictly dispatch to Primary API. If balance/down, triggers automatic customer refund.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setRouteMode("AUTO_FAILOVER")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    routeMode === "AUTO_FAILOVER"
                      ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-200 shadow-lg shadow-cyan-500/10"
                      : "bg-surface-container-highest/50 border-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs mb-1 text-cyan-300">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Smart Auto-Failover</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    If Primary runs out of funds, automatically re-route to Backup Provider without canceling.
                  </p>
                </button>
              </div>
            </div>

            {/* Primary Provider Section */}
            <div className="bg-surface-container-highest/40 border border-white/5 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Primary Provider Node
                </span>
                {routePrimaryProviderId && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Live Bal: ₹
                    {(
                      providers.find((p) => p.id === routePrimaryProviderId)?.balance || 0
                    ).toFixed(2)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    Select Provider
                  </label>
                  <select
                    value={routePrimaryProviderId}
                    onChange={(e) => setRoutePrimaryProviderId(e.target.value)}
                    className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="">Simulated / Internal Node</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.balance.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    Upstream Service / Package ID
                  </label>
                  <input
                    type="text"
                    value={routePrimaryServiceId}
                    onChange={(e) => setRoutePrimaryServiceId(e.target.value)}
                    placeholder="e.g. 1042"
                    className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Backup Provider Section (Visible if AUTO_FAILOVER) */}
            {routeMode === "AUTO_FAILOVER" && (
              <div className="bg-cyan-500/[0.04] border border-cyan-500/20 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-cyan-400" />
                    Backup / Failover Provider Node
                  </span>
                  {routeBackupProviderId && (
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                      Live Bal: ₹
                      {(
                        providers.find((p) => p.id === routeBackupProviderId)?.balance || 0
                      ).toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] uppercase font-mono text-cyan-400/80 block mb-1">
                      Select Backup Provider
                    </label>
                    <select
                      value={routeBackupProviderId}
                      onChange={(e) => setRouteBackupProviderId(e.target.value)}
                      className="w-full bg-surface-container-highest border border-cyan-500/30 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="">Select Backup Provider</option>
                      {providers
                        .filter((p) => p.id !== routePrimaryProviderId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₹{p.balance.toFixed(2)})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-mono text-cyan-400/80 block mb-1">
                      Backup Upstream Service ID
                    </label>
                    <input
                      type="text"
                      value={routeBackupServiceId}
                      onChange={(e) => setRouteBackupServiceId(e.target.value)}
                      placeholder="e.g. 882"
                      className="w-full bg-surface-container-highest border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setRoutingService(null)}
                className="px-5 py-2 rounded-full border border-white/10 hover:bg-white/5 text-xs text-slate-300 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingRouting}
                onClick={handleSaveRouting}
                className="px-6 py-2 rounded-full btn-primary-gradient text-[#171e00] text-xs font-bold hover:brightness-110 shadow-lg shadow-[#D8EC8D]/20 flex items-center gap-2"
              >
                {savingRouting ? (
                  <span>Saving Routing...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save & Apply Routing</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
