"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCustomer } from "@/context/CustomerContext";
import {
  Search,
  Zap,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  Flame,
  Filter,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";

export default function ServicesCatalogPage() {
  const { services } = useCustomer();
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedServiceId, setCopiedServiceId] = useState<string | null>(null);

  const platforms = [
    { id: "ALL", name: "All Networks", icon: "🌐" },
    { id: "instagram", name: "Instagram", icon: "📸" },
    { id: "youtube", name: "YouTube", icon: "▶️" },
    { id: "tiktok", name: "TikTok", icon: "🎵" },
    { id: "telegram", name: "Telegram", icon: "✈️" },
    { id: "twitter", name: "X (Twitter)", icon: "🐦" },
    { id: "spotify", name: "Spotify", icon: "🎧" },
    { id: "linkedin", name: "LinkedIn", icon: "💼" },
  ];

  const categories = Array.from(
    new Set(
      services
        .filter((s) => {
          if (selectedPlatform === "ALL") return true;
          const p = s.platform.toLowerCase().replace("_", "");
          const selectedP = selectedPlatform.toLowerCase().replace("_", "");
          return p === selectedP || (selectedP === "twitter" && p === "xtwitter");
        })
        .map((s) => s.categoryName)
    )
  );

  const filteredServices = services.filter((service) => {
    const p = service.platform.toLowerCase().replace("_", "");
    const selectedP = selectedPlatform.toLowerCase().replace("_", "");
    const matchesPlatform = selectedPlatform === "ALL" || p === selectedP || (selectedP === "twitter" && p === "xtwitter");
    const matchesCategory = selectedCategory === "ALL" || service.categoryName === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      query === "" ||
      service.id.toLowerCase().includes(query) ||
      service.name.toLowerCase().includes(query) ||
      service.description.toLowerCase().includes(query);

    return matchesPlatform && matchesCategory && matchesSearch;
  });

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedServiceId(id);
    setTimeout(() => setCopiedServiceId(null), 1500);
  };

  return (
    <div className="w-full bg-[#0e0e0e] min-h-screen pb-24 text-on-surface">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Header Telemetry */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#DBEF90]">
              <span className="w-2 h-2 rounded-full bg-[#DBEF90] animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                Algorithmic Service Catalog / High-Frequency Dispatch
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-3xl md:text-4xl font-light text-white tracking-tight">Services Matrix</h1>
              <span className="text-[#DBEF90] text-3xl font-light leading-none">*</span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Live automated cluster routing rates per 1,000 units with non-drop telemetry guarantees.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/new-order"
              className="px-5 py-2.5 rounded-full bg-[#DBEF90] text-[#2a3400] text-xs font-bold hover:brightness-110 flex items-center gap-2 shadow-[0_0_20px_rgba(219,239,144,0.3)]"
            >
              <Zap className="w-4 h-4" />
              <span>Launch Order</span>
            </Link>
          </div>
        </div>

        {/* Platform Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {platforms.map((p) => {
            const isSelected = selectedPlatform === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPlatform(p.id);
                  setSelectedCategory("ALL");
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  isSelected
                    ? "bg-[#d8ec8d] text-[#2a3400] shadow-[0_0_15px_rgba(219,239,144,0.25)] font-bold scale-[1.02]"
                    : "bg-surface-container-low border border-white/5 text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <span>{p.icon}</span>
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Category Chips */}
        <div className="glass-panel p-4 rounded-3xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search service by name, ID (e.g. 1042), keyword..."
              className="w-full bg-surface-container-highest/80 border border-white/5 focus:border-[#DBEF90] rounded-2xl pl-11 pr-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none transition-all font-mono"
            />
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setSelectedCategory("ALL")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
                  selectedCategory === "ALL"
                    ? "bg-white/20 text-white"
                    : "bg-surface-container-high/60 text-on-surface-variant hover:text-white"
                }`}
              >
                All Types
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
                    selectedCategory === cat
                      ? "bg-white/20 text-white"
                      : "bg-surface-container-high/60 text-on-surface-variant hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <GlassCard
              key={service.id}
              variant="squircle"
              className="p-6 flex flex-col justify-between group space-y-4 hover:border-[#DBEF90]/40"
            >
              <div className="space-y-3">
                {/* Top Badge & Service ID */}
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-surface-container-high border border-white/5 text-[10px] uppercase tracking-wider font-mono text-on-surface-variant">
                    {service.platform} • {service.categoryName}
                  </span>
                  <button
                    onClick={() => handleCopyId(service.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-on-surface-variant hover:text-[#DBEF90] transition-colors"
                    title="Copy API Service ID"
                  >
                    <span>ID: #{service.id}</span>
                    {copiedServiceId === service.id ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 opacity-60" />
                    )}
                  </button>
                </div>

                {/* Title */}
                <h3 className="text-sm font-semibold text-white leading-snug group-hover:text-[#DBEF90] transition-colors">
                  {service.name}
                </h3>

                {/* Description */}
                <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2">
                  {service.description}
                </p>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-mono">
                  <div className="bg-white/5 rounded-xl p-2.5">
                    <span className="text-[10px] text-on-surface-variant block">Min / Max Capacity</span>
                    <span className="text-white font-bold">
                      {service.minQty.toLocaleString()} – {service.maxQty.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5">
                    <span className="text-[10px] text-on-surface-variant block">Velocity Speed</span>
                    <span className="text-[#DBEF90] font-bold">{service.avgProcessingSpeed || "Fast"}</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5">
                    <span className="text-[10px] text-on-surface-variant block">Drop Rate SLA</span>
                    <span className="text-emerald-400 font-bold">{service.badge || "0% Drop Guarantee"}</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5">
                    <span className="text-[10px] text-on-surface-variant block">Refill Period</span>
                    <span className="text-purple-300 font-bold">
                      {service.refillable ? "30 Days Warranty" : "Instant Non-Drop"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Price & Order Trigger */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-on-surface-variant block">
                    Rate per 1,000
                  </span>
                  <div className="text-lg font-bold text-[#DBEF90] font-mono">
                    ₹{service.ratePer1000.toFixed(2)}
                  </div>
                </div>

                <Link
                  href={`/new-order?serviceId=${service.id}`}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-[#DBEF90] text-white hover:text-[#2a3400] text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
                >
                  <span>Dispatch</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
}
