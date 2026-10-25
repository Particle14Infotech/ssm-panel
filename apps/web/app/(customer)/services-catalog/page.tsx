"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCustomer } from "@/context/CustomerContext";
import {
  Search,
  Check,
  Copy,
  ShieldCheck,
  ArrowRight,
  PlusCircle,
  Inbox,
  Layers,
  Globe,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { motion } from "framer-motion";
import { formatServiceId } from "@/lib/utils";

export default function ServicesCatalogPage() {
  const { services } = useCustomer();
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedServiceId, setCopiedServiceId] = useState<string | null>(null);

  const platforms = [
    { id: "ALL", name: "All Networks" },
    { id: "instagram", name: "Instagram" },
    { id: "youtube", name: "YouTube" },
    { id: "tiktok", name: "TikTok" },
    { id: "telegram", name: "Telegram" },
    { id: "twitter", name: "X (Twitter)" },
    { id: "spotify", name: "Spotify" },
    { id: "general", name: "General" },
  ];

  const categories = Array.from(
    new Set(
      services
        .filter((s) => {
          if (selectedPlatform === "ALL") return true;
          const p = (s.platform || "general").toLowerCase().replace("_", "");
          const selectedP = selectedPlatform.toLowerCase().replace("_", "");
          return p === selectedP || (selectedP === "twitter" && p === "xtwitter");
        })
        .map((s) => s.categoryName)
    )
  );

  const filteredServices = services.filter((service) => {
    const p = (service.platform || "general").toLowerCase().replace("_", "");
    const selectedP = selectedPlatform.toLowerCase().replace("_", "");
    const matchesPlatform =
      selectedPlatform === "ALL" ||
      p === selectedP ||
      (selectedP === "twitter" && p === "xtwitter");
    const matchesCategory =
      selectedCategory === "ALL" || service.categoryName === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      query === "" ||
      service.id.toLowerCase().includes(query) ||
      service.name.toLowerCase().includes(query) ||
      (service.description && service.description.toLowerCase().includes(query));

    return matchesPlatform && matchesCategory && matchesSearch;
  });

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedServiceId(id);
    setTimeout(() => setCopiedServiceId(null), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-8 pb-16"
    >
      {/* Header Clean (Telemetry pill & beam glow removed) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-white tracking-tight">Services Matrix</h1>
          <p className="text-xs text-slate-400">
            Transparent pricing per 1,000 units with non-drop telemetry and warranty refills.
          </p>
        </div>

        <Link
          href="/new-order"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold hover:brightness-105 shadow-sm transition-all self-start sm:self-auto"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Place New Order</span>
        </Link>
      </div>

      {/* Filter and Search Container */}
      <div className="glass-panel p-4 space-y-4">
        {/* Platforms Ribbon with REAL Brand Logos */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {platforms.map((plat) => {
            const isSelected = selectedPlatform === plat.id;
            return (
              <motion.button
                key={plat.id}
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedPlatform(plat.id);
                  setSelectedCategory("ALL");
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-2 border ${
                  isSelected
                    ? "bg-[#D8EC8D] text-[#131313] font-bold border-[#D8EC8D] shadow-sm"
                    : "bg-white/[0.03] border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.07] hover:border-white/20"
                }`}
              >
                {plat.id === "ALL" ? (
                  <Globe className="w-3.5 h-3.5 text-current shrink-0" />
                ) : (
                  <PlatformIcon platform={plat.id} size={16} useBrandColor={!isSelected} />
                )}
                <span>{plat.name}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Search & Category Filter Row */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1 border-t border-white/5">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by service name, ID, or description..."
              className="w-full bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none transition-all"
            />
          </div>

          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-56 bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-sans"
            >
              <option value="ALL" className="bg-[#131313]">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c} value={c} className="bg-[#131313]">
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Services Table */}
      <div className="glass-panel p-4 md:p-6 rounded-3xl overflow-hidden space-y-4">
        {services.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Catalog empty"
            description="The services catalog is currently being updated by the administrator. Please check back shortly."
          />
        ) : filteredServices.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-mono">
            No services match the current filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                  <th className="py-3 px-3">ID</th>
                  <th className="py-3 px-3">Service Name</th>
                  <th className="py-3 px-3">Rate / 1k</th>
                  <th className="py-3 px-3">Min / Max</th>
                  <th className="py-3 px-3">Warranty</th>
                  <th className="py-3 px-3 text-right">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {filteredServices.map((service) => (
                  <tr key={service.id} className="hover:bg-white/[0.03] transition-colors group">
                    {/* ID */}
                    <td className="py-3.5 px-3 font-mono font-medium text-slate-400 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-semibold">{formatServiceId(service.id)}</span>
                        <button
                          onClick={() => handleCopyId(formatServiceId(service.id))}
                          className="hover:text-white transition-colors"
                          title="Copy ID"
                        >
                          {copiedServiceId === service.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-300" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Name & Platform with REAL Logo */}
                    <td className="py-3.5 px-3">
                      <div className="font-medium text-white max-w-md">{service.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/5 text-[10px] text-slate-300 font-mono uppercase">
                          <PlatformIcon platform={service.platform} size={13} useBrandColor={true} />
                          <span>{service.platform}</span>
                        </span>
                        <span className="text-white/20">•</span>
                        <span className="text-[10px] text-slate-400">
                          {service.categoryName}
                        </span>
                      </div>
                    </td>

                    {/* Rate per 1000 */}
                    <td className="py-3.5 px-3 font-mono font-semibold text-white whitespace-nowrap">
                      ₹{service.ratePer1000.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    {/* Min / Max */}
                    <td className="py-3.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                      <span>{service.minQty.toLocaleString()}</span>
                      <span className="mx-1 text-slate-600">/</span>
                      <span>{service.maxQty.toLocaleString()}</span>
                    </td>

                    {/* Warranty */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {service.refillable ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                          <ShieldCheck className="w-3 h-3" />
                          <span>30d Refill</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-400">
                          Non-Drop
                        </span>
                      )}
                    </td>

                    {/* Order CTA */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <Link
                        href={`/new-order?serviceId=${service.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#D8EC8D]/15 hover:bg-[#D8EC8D] text-[#D8EC8D] hover:text-[#171e00] border border-[#D8EC8D]/30 text-xs font-bold hover:brightness-105 transition-all shadow-sm"
                      >
                        <span>Select</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
