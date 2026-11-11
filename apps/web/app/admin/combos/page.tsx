"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getApiBase } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth-session";
import {
  Boxes,
  PlusCircle,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Sparkles,
  Search,
  Tag,
  DollarSign,
  Clock,
  ChevronRight,
  Eye,
  Heart,
  Share2,
  Users,
  ShieldCheck,
  TrendingUp,
  X,
  Plus,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface ServiceItem {
  id: string;
  name: string;
  displayName?: string;
  platform: string;
  ratePer1000: number;
  status: string;
}

interface PackageItem {
  id: string;
  serviceId: string;
  quantity: number;
  kind: string;
  allocationBp: number;
  service: {
    id: string;
    name: string;
    displayName?: string;
    ratePer1000: number;
    providerCostPer1k?: number;
    status: string;
  };
}

interface PackageTier {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  soldCount: number;
  version: number;
  active: boolean;
  items: PackageItem[];
}

interface PackageTemplate {
  id: string;
  platform: string;
  slug: string;
  name: string;
  description?: string;
  badge?: string;
  pricingMode: string;
  active: boolean;
  archived: boolean;
  displayOrder: number;
  tiers: PackageTier[];
}

export default function AdminCombosPage() {
  const [templates, setTemplates] = useState<PackageTemplate[]>([]);
  const [catalogServices, setCatalogServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTiersModal, setShowTiersModal] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<PackageTemplate | null>(null);

  // Form states - Create / Edit Plan
  const [formName, setFormName] = useState("");
  const [formPlatform, setFormPlatform] = useState("INSTAGRAM");
  const [formSlug, setFormSlug] = useState("");
  const [formBadge, setFormBadge] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDisplayOrder, setFormDisplayOrder] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Tier addition form
  const [newTierName, setNewTierName] = useState("");
  const [newTierPrice, setNewTierPrice] = useState<number | "">("");
  const [newTierDays, setNewTierDays] = useState<number>(7);
  const [isAddingTier, setIsAddingTier] = useState(false);

  // Item addition form inside active tier
  const [selectedTierForItems, setSelectedTierForItems] = useState<string | null>(null);
  const [newItemServiceId, setNewItemServiceId] = useState("");
  const [newItemQty, setNewItemQty] = useState<number | "">("");
  const [newItemKind, setNewItemKind] = useState("VIEWS");
  const [isAddingItem, setIsAddingItem] = useState(false);

  // Load Templates
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setErrorNotice(null);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/admin/package-templates`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load packages");
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setErrorNotice(err.message || "Could not retrieve combo packages.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load Services Catalog
  const fetchServices = useCallback(async () => {
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/services`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setCatalogServices(data);
      }
    } catch (e) {
      console.warn("Failed to load services for combo mapping", e);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchServices();
  }, [fetchTemplates, fetchServices]);

  // Platforms filter list
  const platforms = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => set.add(t.platform));
    return ["ALL", ...Array.from(set)];
  }, [templates]);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.badge?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPlatform =
        selectedPlatform === "ALL" || t.platform.toUpperCase() === selectedPlatform.toUpperCase();
      return matchesSearch && matchesPlatform;
    });
  }, [templates, searchQuery, selectedPlatform]);

  // Toggle active status
  const handleToggleActive = async (templateId: string) => {
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/admin/package-templates/${templateId}/toggle-active`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to toggle status");
      }
      setSuccessNotice("Package status updated.");
      setTimeout(() => setSuccessNotice(null), 3000);
      fetchTemplates();
    } catch (err: any) {
      setErrorNotice(err.message);
      setTimeout(() => setErrorNotice(null), 4000);
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (templateId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete or archive '${name}'?`)) return;
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/admin/package-templates/${templateId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete");
      }
      setSuccessNotice(`Combo '${name}' removed.`);
      setTimeout(() => setSuccessNotice(null), 3000);
      fetchTemplates();
    } catch (err: any) {
      setErrorNotice(err.message);
      setTimeout(() => setErrorNotice(null), 4000);
    }
  };

  // Create Template
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) {
      setErrorNotice("Name and slug are required.");
      return;
    }
    setIsSaving(true);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/admin/package-templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          platform: formPlatform.toUpperCase(),
          slug: formSlug.toLowerCase().trim(),
          name: formName.trim(),
          badge: formBadge.trim() || undefined,
          description: formDescription.trim() || undefined,
          displayOrder: Number(formDisplayOrder) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Creation failed");
      setSuccessNotice(`Created '${data.name}'!`);
      setTimeout(() => setSuccessNotice(null), 3000);
      setShowCreateModal(false);
      resetForms();
      fetchTemplates();
    } catch (err: any) {
      setErrorNotice(err.message);
      setTimeout(() => setErrorNotice(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Update Template
  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTemplate) return;
    setIsSaving(true);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/admin/package-templates/${activeTemplate.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: formName.trim(),
          badge: formBadge.trim() || undefined,
          description: formDescription.trim() || undefined,
          displayOrder: Number(formDisplayOrder) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Update failed");
      setSuccessNotice(`Updated '${data.name}'!`);
      setTimeout(() => setSuccessNotice(null), 3000);
      setShowEditModal(false);
      resetForms();
      fetchTemplates();
    } catch (err: any) {
      setErrorNotice(err.message);
      setTimeout(() => setErrorNotice(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Add Tier
  const handleAddTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTemplate || !newTierName.trim() || typeof newTierPrice !== "number") return;
    setIsAddingTier(true);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/admin/package-templates/${activeTemplate.id}/tiers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: newTierName.trim(),
          price: Number(newTierPrice),
          durationDays: Number(newTierDays) || 7,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add tier");
      setSuccessNotice(`Added tier '${data.name}'!`);
      setTimeout(() => setSuccessNotice(null), 3000);
      setNewTierName("");
      setNewTierPrice("");
      // Refresh current active template data
      await fetchTemplates();
      const updatedTmplRes = await fetch(`${apiBase}/admin/package-templates/${activeTemplate.id}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const updated = await updatedTmplRes.json();
      if (updated.template) setActiveTemplate(updated.template);
    } catch (err: any) {
      setErrorNotice(err.message);
      setTimeout(() => setErrorNotice(null), 4000);
    } finally {
      setIsAddingTier(false);
    }
  };

  // Delete Tier
  const handleDeleteTier = async (tierId: string, tierName: string) => {
    if (!activeTemplate || !window.confirm(`Delete tier '${tierName}'?`)) return;
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/admin/package-templates/${activeTemplate.id}/tiers/${tierId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error("Failed to delete tier");
      setSuccessNotice(`Tier '${tierName}' removed.`);
      setTimeout(() => setSuccessNotice(null), 3000);
      await fetchTemplates();
      const updatedTmplRes = await fetch(`${apiBase}/admin/package-templates/${activeTemplate.id}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const updated = await updatedTmplRes.json();
      if (updated.template) setActiveTemplate(updated.template);
    } catch (err: any) {
      setErrorNotice(err.message);
    }
  };

  // Add Item to Tier
  const handleAddItemToTier = async (tierId: string) => {
    if (!activeTemplate || !newItemServiceId || typeof newItemQty !== "number" || newItemQty <= 0) return;
    setIsAddingItem(true);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/admin/package-templates/${activeTemplate.id}/tiers/${tierId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          serviceId: newItemServiceId,
          quantity: Number(newItemQty),
          kind: newItemKind,
        }),
      });
      if (!res.ok) throw new Error("Failed to add service item");
      setSuccessNotice("Bundled service item added!");
      setTimeout(() => setSuccessNotice(null), 3000);
      setNewItemServiceId("");
      setNewItemQty("");
      await fetchTemplates();
      const updatedTmplRes = await fetch(`${apiBase}/admin/package-templates/${activeTemplate.id}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const updated = await updatedTmplRes.json();
      if (updated.template) setActiveTemplate(updated.template);
    } catch (err: any) {
      setErrorNotice(err.message);
    } finally {
      setIsAddingItem(false);
    }
  };

  // Delete Item from Tier
  const handleDeleteItem = async (tierId: string, itemId: string) => {
    if (!activeTemplate) return;
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/admin/package-templates/${activeTemplate.id}/tiers/${tierId}/items/${itemId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error("Failed to remove item");
      await fetchTemplates();
      const updatedTmplRes = await fetch(`${apiBase}/admin/package-templates/${activeTemplate.id}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const updated = await updatedTmplRes.json();
      if (updated.template) setActiveTemplate(updated.template);
    } catch (err: any) {
      setErrorNotice(err.message);
    }
  };

  const resetForms = () => {
    setFormName("");
    setFormPlatform("INSTAGRAM");
    setFormSlug("");
    setFormBadge("");
    setFormDescription("");
    setFormDisplayOrder(0);
    setActiveTemplate(null);
  };

  const openEditModal = (tmpl: PackageTemplate) => {
    setActiveTemplate(tmpl);
    setFormName(tmpl.name);
    setFormPlatform(tmpl.platform);
    setFormSlug(tmpl.slug);
    setFormBadge(tmpl.badge || "");
    setFormDescription(tmpl.description || "");
    setFormDisplayOrder(tmpl.displayOrder || 0);
    setShowEditModal(true);
  };

  const openTiersModal = (tmpl: PackageTemplate) => {
    setActiveTemplate(tmpl);
    setShowTiersModal(true);
    if (tmpl.tiers && tmpl.tiers.length > 0) {
      setSelectedTierForItems(tmpl.tiers[0].id);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6 max-w-[1560px] mx-auto pb-16">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Boxes className="w-5 h-5 text-[#D8EC8D]" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-fg tracking-tight flex items-center gap-2">
                Combo Packages Matrix
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-[#D8EC8D] font-mono font-bold">
                  ADMIN RESTRICTED
                </span>
              </h1>
              <p className="text-xs text-fg-muted">
                Admin-controlled multi-metric engagement bundles, automated tiers, and wholesale margin controls.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchTemplates}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-surface-raised hover:bg-surface-elevated text-fg-2 font-medium text-xs border border-border flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              resetForms();
              setShowCreateModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-[#D8EC8D] hover:bg-[#cbe27a] text-black font-extrabold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(216,236,141,0.25)] transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Create Combo Plan
          </button>
        </div>
      </div>

      {/* Notice Alerts */}
      {errorNotice && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorNotice}</span>
        </div>
      )}
      {successNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Stat KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
          <span className="text-[11px] font-mono text-fg-muted uppercase tracking-wider">Total Packages</span>
          <div className="text-2xl font-black text-fg font-mono">{templates.length}</div>
        </div>
        <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
          <span className="text-[11px] font-mono text-fg-muted uppercase tracking-wider">Active in Customer UI</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {templates.filter((t) => t.active).length}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
          <span className="text-[11px] font-mono text-fg-muted uppercase tracking-wider">Total Tiers Configured</span>
          <div className="text-2xl font-black text-[#D8EC8D] font-mono">
            {templates.reduce((acc, t) => acc + (t.tiers?.length || 0), 0)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
          <span className="text-[11px] font-mono text-fg-muted uppercase tracking-wider">Platforms Configured</span>
          <div className="text-2xl font-black text-blue-400 font-mono">{platforms.length - 1}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-surface border border-border">
        {/* Platform Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {platforms.map((plat) => (
            <button
              key={plat}
              onClick={() => setSelectedPlatform(plat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                selectedPlatform === plat
                  ? "bg-[#D8EC8D] text-black shadow-[0_0_10px_rgba(216,236,141,0.2)]"
                  : "bg-surface-raised text-fg-2 hover:bg-surface-elevated border border-border"
              }`}
            >
              {plat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search combos..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-surface-raised border border-border text-fg text-xs placeholder-fg-muted/60 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Templates List Cards */}
      {isLoading ? (
        <div className="p-16 text-center text-fg-muted font-mono text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#D8EC8D]" />
          Loading combo packages matrix...
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-surface border border-border text-fg-muted text-xs space-y-3">
          <Boxes className="w-10 h-10 mx-auto text-fg-muted/40" />
          <p>No combo packages match your current search/filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTemplates.map((tmpl) => (
            <div
              key={tmpl.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                tmpl.active
                  ? "bg-surface border-border hover:border-accent/40"
                  : "bg-surface/50 border-dashed border-border opacity-70"
              }`}
            >
              <div className="space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-raised border border-border text-fg-muted">
                        {tmpl.platform}
                      </span>
                      {tmpl.badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 border border-accent/25 text-[#D8EC8D] uppercase">
                          {tmpl.badge}
                        </span>
                      )}
                      {!tmpl.active && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          DRAFT / INACTIVE
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-fg mt-1">{tmpl.name}</h3>
                    <p className="text-xs text-fg-muted font-mono">slug: {tmpl.slug}</p>
                    {tmpl.description && (
                      <p className="text-xs text-fg-2 mt-1 line-clamp-2">{tmpl.description}</p>
                    )}
                  </div>

                  {/* Active Toggle Switch */}
                  <button
                    onClick={() => handleToggleActive(tmpl.id)}
                    title={tmpl.active ? "Set to Draft" : "Publish to Customer UI"}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-colors ${
                      tmpl.active
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                        : "bg-slate-500/10 border-slate-500/30 text-slate-400 hover:bg-slate-500/20"
                    }`}
                  >
                    {tmpl.active ? "● ACTIVE" : "○ DRAFT"}
                  </button>
                </div>

                {/* Tiers Preview */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs text-fg-muted">
                    <span className="font-semibold text-fg-2 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#D8EC8D]" />
                      Configured Tiers ({tmpl.tiers?.length || 0})
                    </span>
                    <button
                      onClick={() => openTiersModal(tmpl)}
                      className="text-[#D8EC8D] hover:underline text-[11px] font-semibold"
                    >
                      Manage Tiers & Services →
                    </button>
                  </div>

                  {tmpl.tiers && tmpl.tiers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {tmpl.tiers.map((tier) => (
                        <div
                          key={tier.id}
                          className="p-2.5 rounded-xl bg-surface-raised border border-border space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-fg truncate">{tier.name}</span>
                            <span className="text-[11px] font-mono font-extrabold text-[#D8EC8D]">
                              {formatCurrency(Number(tier.price))}
                            </span>
                          </div>
                          <div className="text-[10px] text-fg-muted font-mono flex items-center justify-between">
                            <span>{tier.items?.length || 0} services</span>
                            <span>{tier.durationDays}d pacing</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-fg-muted italic">No tiers added yet.</p>
                  )}
                </div>
              </div>

              {/* Bottom Actions Row */}
              <div className="flex items-center justify-end gap-2 pt-4 mt-3 border-t border-border">
                <button
                  onClick={() => openEditModal(tmpl)}
                  className="px-3 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-elevated text-fg-2 text-xs font-semibold border border-border flex items-center gap-1.5 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit Plan
                </button>
                <button
                  onClick={() => handleDeleteTemplate(tmpl.id, tmpl.name)}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-base font-extrabold text-fg flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-[#D8EC8D]" />
                Create New Combo Package
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-surface-raised text-fg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTemplate} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-fg-2">Package Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (!formSlug) {
                      setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                    }
                  }}
                  placeholder="e.g. YouTube Viral Velocity Pack"
                  className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-border text-fg text-xs focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-fg-2">Platform *</label>
                  <select
                    value={formPlatform}
                    onChange={(e) => setFormPlatform(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-border text-fg text-xs focus:outline-none focus:border-accent"
                  >
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="YOUTUBE">YouTube</option>
                    <option value="TIKTOK">TikTok</option>
                    <option value="TELEGRAM">Telegram</option>
                    <option value="TWITTER">X (Twitter)</option>
                    <option value="FACEBOOK">Facebook</option>
                    <option value="SPOTIFY">Spotify</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-fg-2">Slug (Unique URL key) *</label>
                  <input
                    type="text"
                    required
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="youtube-viral-pack"
                    className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-border text-fg text-xs font-mono focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-fg-2">Badge Text</label>
                  <input
                    type="text"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    placeholder="e.g. 50% SAVINGS / VIRAL ALGORITHM"
                    className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-border text-fg text-xs focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-fg-2">Display Order</label>
                  <input
                    type="number"
                    value={formDisplayOrder}
                    onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-border text-fg text-xs focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-fg-2">Description</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Summary of what this combo plan delivers..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-border text-fg text-xs focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-raised hover:bg-surface-elevated text-fg-2 text-xs font-bold border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-[#D8EC8D] hover:bg-[#cbe27a] text-black font-extrabold text-xs flex items-center gap-1.5"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && activeTemplate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-base font-extrabold text-fg flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#D8EC8D]" />
                Edit Plan: {activeTemplate.name}
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg hover:bg-surface-raised text-fg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateTemplate} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-fg-2">Package Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-border text-fg text-xs focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-fg-2">Badge Text</label>
                  <input
                    type="text"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-border text-fg text-xs focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-fg-2">Display Order</label>
                  <input
                    type="number"
                    value={formDisplayOrder}
                    onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-border text-fg text-xs focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-fg-2">Description</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-border text-fg text-xs focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-raised hover:bg-surface-elevated text-fg-2 text-xs font-bold border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-[#D8EC8D] hover:bg-[#cbe27a] text-black font-extrabold text-xs flex items-center gap-1.5"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE TIERS & BUNDLED SERVICES MODAL */}
      {showTiersModal && activeTemplate && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface-raised">
              <div>
                <h2 className="text-base font-extrabold text-fg flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#D8EC8D]" />
                  Tiers & Bundled Services: {activeTemplate.name}
                </h2>
                <p className="text-xs text-fg-muted font-mono">
                  Platform: {activeTemplate.platform} | Slug: {activeTemplate.slug}
                </p>
              </div>
              <button
                onClick={() => setShowTiersModal(false)}
                className="p-1 rounded-lg hover:bg-surface text-fg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Existing Tiers Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold text-fg uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#D8EC8D]" />
                  Existing Package Tiers
                </h3>

                {activeTemplate.tiers && activeTemplate.tiers.length > 0 ? (
                  <div className="space-y-4">
                    {activeTemplate.tiers.map((tier) => (
                      <div
                        key={tier.id}
                        className={`p-4 rounded-xl border transition-all ${
                          selectedTierForItems === tier.id
                            ? "bg-surface-raised border-[#D8EC8D]/60 ring-1 ring-[#D8EC8D]/30"
                            : "bg-surface border-border"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-fg">{tier.name}</span>
                              <span className="text-sm font-mono font-extrabold text-[#D8EC8D]">
                                {formatCurrency(Number(tier.price))}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border text-fg-muted font-mono">
                                {tier.durationDays} Days Paced
                              </span>
                            </div>
                            <span className="text-[11px] text-fg-muted font-mono">
                              Sold count: {tier.soldCount} • Version: {tier.version}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedTierForItems(tier.id)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                                selectedTierForItems === tier.id
                                  ? "bg-[#D8EC8D] text-black border-[#D8EC8D]"
                                  : "bg-surface text-fg-2 border-border hover:bg-surface-elevated"
                              }`}
                            >
                              {selectedTierForItems === tier.id ? "Managing Items" : "Select to Edit Items"}
                            </button>
                            <button
                              onClick={() => handleDeleteTier(tier.id, tier.name)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                              title="Delete Tier"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Bundled Items in this Tier */}
                        <div className="pt-3 space-y-2">
                          <span className="text-[11px] font-bold text-fg-muted uppercase tracking-wider">
                            Bundled Deliverables ({tier.items?.length || 0}):
                          </span>
                          {tier.items && tier.items.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {tier.items.map((it) => (
                                <div
                                  key={it.id}
                                  className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-extrabold text-[#D8EC8D]">
                                      {it.quantity.toLocaleString()}
                                    </span>
                                    <span className="text-fg-2 truncate max-w-[200px]">
                                      {it.service?.displayName || it.service?.name || it.kind}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteItem(tier.id, it.id)}
                                    className="text-red-400 hover:text-red-300 p-1"
                                    title="Remove item"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-fg-muted italic">No services bundled into this tier yet.</p>
                          )}
                        </div>

                        {/* Add Item form inside this Tier if selected */}
                        {selectedTierForItems === tier.id && (
                          <div className="mt-4 pt-3 border-t border-border bg-surface/40 p-3 rounded-lg space-y-3">
                            <span className="text-xs font-bold text-[#D8EC8D] flex items-center gap-1.5">
                              <Plus className="w-3.5 h-3.5" />
                              Add Bundled Service to {tier.name}
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <div className="sm:col-span-2">
                                <select
                                  value={newItemServiceId}
                                  onChange={(e) => setNewItemServiceId(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-raised border border-border text-fg text-xs"
                                >
                                  <option value="">Select Catalog Service...</option>
                                  {catalogServices.map((svc) => (
                                    <option key={svc.id} value={svc.id}>
                                      {svc.displayName || svc.name} (₹{svc.ratePer1000}/1k)
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <input
                                  type="number"
                                  value={newItemQty}
                                  onChange={(e) => setNewItemQty(e.target.value ? Number(e.target.value) : "")}
                                  placeholder="Quantity (e.g. 1000)"
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-raised border border-border text-fg text-xs"
                                />
                              </div>
                              <div>
                                <select
                                  value={newItemKind}
                                  onChange={(e) => setNewItemKind(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-raised border border-border text-fg text-xs"
                                >
                                  <option value="VIEWS">Views</option>
                                  <option value="LIKES">Likes</option>
                                  <option value="COMMENTS">Comments</option>
                                  <option value="SHARES">Shares/Reposts</option>
                                  <option value="FOLLOWERS">Followers</option>
                                  <option value="OTHER">Other</option>
                                </select>
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                disabled={isAddingItem || !newItemServiceId || !newItemQty}
                                onClick={() => handleAddItemToTier(tier.id)}
                                className="px-3 py-1 rounded-lg bg-[#D8EC8D] text-black font-extrabold text-xs flex items-center gap-1"
                              >
                                {isAddingItem && <Loader2 className="w-3 h-3 animate-spin" />}
                                Add to Tier
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-fg-muted italic">No tiers configured yet for this combo plan.</p>
                )}
              </div>

              {/* Add New Tier Form */}
              <div className="p-4 rounded-xl bg-surface-raised border border-border space-y-3">
                <h4 className="text-xs font-extrabold text-fg uppercase tracking-wider flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-[#D8EC8D]" />
                  Add New Tier to this Plan
                </h4>
                <form onSubmit={handleAddTier} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-fg-muted">Tier Name *</label>
                    <input
                      type="text"
                      required
                      value={newTierName}
                      onChange={(e) => setNewTierName(e.target.value)}
                      placeholder="e.g. Tier 4 — Mega Viral"
                      className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-fg text-xs focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-fg-muted">Selling Price (₹ INR) *</label>
                    <input
                      type="number"
                      required
                      value={newTierPrice}
                      onChange={(e) => setNewTierPrice(e.target.value ? Number(e.target.value) : "")}
                      placeholder="e.g. 5999"
                      className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-fg text-xs font-mono focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-fg-muted">Pacing Days *</label>
                    <input
                      type="number"
                      required
                      value={newTierDays}
                      onChange={(e) => setNewTierDays(Number(e.target.value))}
                      placeholder="e.g. 7"
                      className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-fg text-xs font-mono focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isAddingTier}
                      className="w-full px-3 py-2 rounded-lg bg-[#D8EC8D] text-black font-extrabold text-xs flex items-center justify-center gap-1.5"
                    >
                      {isAddingTier && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Add Tier
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end p-4 border-t border-border bg-surface-raised">
              <button
                onClick={() => setShowTiersModal(false)}
                className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-elevated text-fg font-extrabold text-xs border border-border"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

