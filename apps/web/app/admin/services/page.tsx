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
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export default function AdminServicesPage() {
  const { services, addService, updateService, deleteService } = useAdmin();
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New Service State
  const [newId, setNewId] = useState<string>(`${Math.floor(8000 + Math.random() * 1000)}`);
  const [newName, setNewName] = useState<string>("");
  const [newPlatform, setNewPlatform] = useState<ServicePlatform>("INSTAGRAM");
  const [newCategory, setNewCategory] = useState<string>("Followers");
  const [newRate, setNewRate] = useState<number>(150);
  const [newMin, setNewMin] = useState<number>(100);
  const [newMax, setNewMax] = useState<number>(100000);
  const [newDescription, setNewDescription] = useState<string>("");

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
    };

    addService(created);
    setIsAdding(false);
    setNewName("");
    setNewDescription("");
    setNewId(`${Math.floor(8000 + Math.random() * 1000)}`);
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
            className="px-5 py-2.5 rounded-full bg-[#DBEF90] text-[#2a3400] text-xs font-bold hover:brightness-110 flex items-center gap-2 shadow-[0_0_20px_rgba(219,239,144,0.3)] shrink-0"
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
                ✕ Cancel
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
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                className="px-6 py-2 rounded-full bg-[#DBEF90] text-[#2a3400] text-xs font-bold hover:brightness-110 shadow-md"
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
              className="w-full bg-surface-container-highest/80 border border-white/5 focus:border-[#DBEF90] rounded-2xl pl-11 pr-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none font-mono"
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
                  <th className="py-3 px-3">Rate / 1k (INR)</th>
                  <th className="py-3 px-3">Min / Max</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredServices.map((service) => {
                  const isEditing = editingId === service.id;
                  return (
                    <tr key={service.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-3 font-mono font-bold text-white whitespace-nowrap">
                        <span className="text-[#DBEF90] mr-1">✦</span>
                        #{service.id}
                      </td>
                      <td className="py-4 px-3 font-mono text-on-surface-variant whitespace-nowrap">
                        <span className="text-white font-semibold">{service.platform}</span> • {service.categoryName}
                      </td>
                      <td className="py-4 px-3 font-medium text-white max-w-sm truncate">
                        {service.name}
                      </td>
                      <td className="py-4 px-3 font-mono font-bold text-[#DBEF90] whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={service.ratePer1000}
                            onBlur={(e) => {
                              updateService(service.id, { ratePer1000: Number(e.target.value) });
                              setEditingId(null);
                            }}
                            className="w-20 bg-black border border-[#DBEF90] rounded px-2 py-0.5 text-white"
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
                      <td className="py-4 px-3 text-right whitespace-nowrap">
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
      </div>
    </div>
  );
}
