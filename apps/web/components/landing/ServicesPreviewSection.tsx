"use client";

import React, { useState } from "react";
import Link from "next/link";
import { landingContent } from "@/content/landing";
import { Search, ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { PlatformIcon } from "@/components/shared/PlatformIcon";

export function ServicesPreviewSection() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const platforms = [
    { id: "ALL", label: "All Platforms" },
    { id: "INSTAGRAM", label: "Instagram" },
    { id: "TIKTOK", label: "TikTok" },
    { id: "YOUTUBE", label: "YouTube" },
    { id: "X_TWITTER", label: "X" },
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
    <section id="services" data-crown="dim" className="w-full py-24 bg-transparent relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealOnScroll className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-xs font-mono text-[#D8EC8D] uppercase tracking-widest mb-3 backdrop-blur-md">
              {landingContent.servicesPreview.badge}
            </div>
            <h2 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight">
              {landingContent.servicesPreview.title}
            </h2>
          </div>

          <Link
            href="/services"
            className="text-sm text-[#D8EC8D] hover:text-white flex items-center gap-1.5 group font-medium self-start md:self-auto"
          >
            <span>Browse All 500+ Services</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </RevealOnScroll>

        {/* Filter Bar & Search */}
        <RevealOnScroll delay={0.1}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 bg-[#1c1b1b]/80 p-2 rounded-2xl border border-white/[0.08] backdrop-blur-xl">
            {/* Platform Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlatform(p.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                    selectedPlatform === p.id
                      ? "bg-gradient-to-r from-[#D8EC8D] to-[#BEF264] text-[#171e00] shadow-sm font-semibold border border-white/10"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {p.id !== "ALL" && <PlatformIcon platform={p.id} size={14} />}
                  <span>{p.label}</span>
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search services, platforms..."
                className="w-full bg-[#131313] text-white text-xs pl-10 pr-4 py-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#D8EC8D] placeholder-zinc-500"
              />
            </div>
          </div>
        </RevealOnScroll>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service, idx) => (
            <RevealOnScroll key={service.id} delay={0.06 * Math.min(idx, 6)}>
              <div className="rounded-2xl p-6 bg-gradient-to-b from-white/[0.06] to-white/[0.02] bg-[#1c1b1b]/80 border border-white/[0.08] hover:border-[#D8EC8D]/40 backdrop-blur-xl transition-all duration-300 flex flex-col justify-between group shadow-[0_20px_40px_rgba(0,0,0,0.5)] h-full">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-zinc-300 font-mono backdrop-blur-md flex items-center gap-1.5">
                      <PlatformIcon platform={service.platform} size={12} />
                      {service.platformName}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#DBEF90]/15 text-[#DBEF90] font-semibold border border-[#DBEF90]/20 backdrop-blur-md">
                      {service.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white mb-2 group-hover:text-[#D8EC8D] transition-colors leading-snug">
                    {service.serviceName}
                  </h3>

                  <p className="text-xs text-zinc-400 font-light leading-relaxed mb-6">
                    {service.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/[0.08]">
                  <div className="flex items-baseline justify-between mb-4">
                    <div>
                      <span className="text-xs text-zinc-300 block font-mono">Rate per 1,000</span>
                      <span className="font-heading text-2xl font-light text-white font-sans tabular-nums font-semibold tracking-tight">
                        {formatINR(service.ratePer1000, 2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-zinc-300 block font-mono">Speed</span>
                      <span className="text-xs text-[#DBEF90] font-semibold">{service.avgSpeed}</span>
                    </div>
                  </div>

                  <Link
                    href={`/register`}
                    className="w-full py-2.5 rounded-full bg-white/[0.08] hover:bg-gradient-to-r hover:from-[#D8EC8D] hover:to-[#BEF264] text-white hover:text-[#171e00] border border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <span>Order Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
