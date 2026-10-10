"use client";

import React, { useState } from "react";
import Link from "next/link";
import { landingContent } from "@/content/landing";
import { Search, ArrowRight, Zap, Check, Shield, Layers } from "lucide-react";

export function ServicesPreviewSection() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const platforms = [
    { id: "ALL", label: "All Vectors" },
    { id: "INSTAGRAM", label: "Instagram" },
    { id: "TIKTOK", label: "TikTok" },
    { id: "YOUTUBE", label: "YouTube" },
    { id: "X_TWITTER", label: "X (Twitter)" },
    { id: "TELEGRAM", label: "Telegram" },
  ];

  const filteredServices = landingContent.servicesPreview.items.filter((item) => {
    const matchesPlatform = selectedPlatform === "ALL" || item.platform === selectedPlatform;
    const matchesSearch =
      item.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPlatform && matchesSearch;
  });

  return (
    <section id="services-preview" className="w-full py-24 bg-[#0e0e0e] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1c1b1b] border border-white/10 text-xs font-mono text-[#d8ec8d] uppercase tracking-widest mb-3">
              {landingContent.servicesPreview.badge}
            </div>
            <h2 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight">
              {landingContent.servicesPreview.title}
            </h2>
          </div>

          <Link
            href="/services"
            className="text-sm text-[#d8ec8d] hover:text-white flex items-center gap-1.5 group font-medium self-start md:self-auto"
          >
            <span>Browse All 500+ Services</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Filter Bar & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 bg-[#1c1b1b]/70 p-2 rounded-2xl border border-white/10 backdrop-blur-md">
          {/* Platform Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
            {platforms.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPlatform(p.id)}
                className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  selectedPlatform === p.id
                    ? "bg-[#353534] text-white shadow-sm font-semibold"
                    : "text-[#c7c8b6] hover:text-white hover:bg-[#201f1f]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#c7c8b6]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services, platforms..."
              className="w-full bg-[#131313] text-white text-xs pl-10 pr-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#d8ec8d] placeholder-[#c7c8b6]/50"
            />
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="rounded-3xl p-6 bg-[#1c1b1b]/80 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between group shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[#201f1f] text-[#c7c8b6] font-mono">
                    {service.platformName}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#d8ec8d]/15 text-[#d8ec8d] font-semibold">
                    {service.badge}
                  </span>
                </div>

                <h3 className="text-base font-semibold text-white mb-2 group-hover:text-[#d8ec8d] transition-colors leading-snug">
                  {service.serviceName}
                </h3>

                <p className="text-xs text-[#c7c8b6] font-light leading-relaxed mb-6">
                  {service.description}
                </p>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    <span className="text-xs text-[#c7c8b6] block font-mono">Rate per 1,000</span>
                    <span className="font-heading text-2xl font-light text-white">
                      ${service.ratePer1000.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-[#c7c8b6] block font-mono">Speed</span>
                    <span className="text-xs text-[#d8ec8d] font-semibold">{service.avgSpeed}</span>
                  </div>
                </div>

                <Link
                  href={`/app/new-order?service=${service.id}`}
                  className="w-full py-2.5 rounded-full bg-[#201f1f] hover:bg-[#d8ec8d] hover:text-[#171e00] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <span>Order Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
