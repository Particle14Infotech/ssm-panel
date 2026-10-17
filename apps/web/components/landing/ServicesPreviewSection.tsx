"use client";

import React, { useState } from "react";
import Link from "next/link";
import { landingContent } from "@/content/landing";
import { ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { PlatformIcon } from "@/components/shared/PlatformIcon";

export function ServicesPreviewSection() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");

  const platforms = [
    { id: "ALL", label: "All Platforms" },
    { id: "INSTAGRAM", label: "Instagram" },
    { id: "YOUTUBE", label: "YouTube" },
    { id: "TIKTOK", label: "TikTok" },
    { id: "TELEGRAM", label: "Telegram" },
    { id: "X_TWITTER", label: "X" },
  ];

  const filteredServices = landingContent.servicesPreview.items.filter((item) => {
    return selectedPlatform === "ALL" || item.platform === selectedPlatform;
  });

  return (
    <section id="services" className="w-full py-14 md:py-[72px] lg:py-28 bg-transparent relative">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Title Block */}
        <RevealOnScroll className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="max-w-[560px]">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
              <span className="text-[13px] font-medium text-[#d8ec8d]">
                Services & Pricing
              </span>
            </div>
            <h2 className="text-[clamp(30px,3.6vw,44px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-3">
              Clear rates per 1,000 units
            </h2>
            <p className="text-base text-[#A1A1AA] font-normal leading-relaxed">
              Explore popular services across platforms with upfront pricing and delivery estimates.
            </p>
          </div>

          <Link
            href="/services"
            className="text-sm font-semibold text-[#d8ec8d] hover:text-white flex items-center gap-1.5 transition-colors self-start md:self-auto"
          >
            <span>View all services</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </RevealOnScroll>

        {/* Platform Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-6 scrollbar-none">
          {platforms.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPlatform(p.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                selectedPlatform === p.id
                  ? "bg-[#d8ec8d] text-[#171e00]"
                  : "text-[#A1A1AA] hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              {p.id !== "ALL" && <PlatformIcon platform={p.id} size={14} />}
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block rounded-[20px] border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] text-xs font-medium text-[#A1A1AA]">
                <th className="py-4 px-6">Service</th>
                <th className="py-4 px-6">Rate / 1,000</th>
                <th className="py-4 px-6">Min – Max</th>
                <th className="py-4 px-6">Speed</th>
                <th className="py-4 px-6 text-right">Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-sm">
              {filteredServices.map((service) => (
                <tr
                  key={service.id}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-4 px-6 font-medium text-white">
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon platform={service.platform} size={16} />
                      <span>{service.serviceName}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 font-semibold tabular-nums text-white">
                    {formatINR(service.ratePer1000, 2)}
                  </td>
                  <td className="py-4 px-6 text-[#A1A1AA] text-xs tabular-nums font-mono">
                    {service.minQty.toLocaleString("en-US")} – {service.maxQty.toLocaleString("en-US")}
                  </td>
                  <td className="py-4 px-6 text-[#A1A1AA] text-xs">
                    {service.avgSpeed}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <Link
                      href="/register"
                      className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-white/[0.06] hover:bg-[#d8ec8d] hover:text-[#171e00] text-xs font-semibold text-white transition-all"
                    >
                      <span>Order</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Compact Cards */}
        <div className="md:hidden flex flex-col gap-3">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="rounded-[16px] p-4 border border-white/[0.08] bg-white/[0.02] flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={service.platform} size={16} />
                  <span className="text-sm font-semibold text-white">
                    {service.serviceName}
                  </span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-[#d8ec8d]">
                  {formatINR(service.ratePer1000, 2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-[#A1A1AA] pt-2 border-t border-white/[0.06]">
                <span>Speed: {service.avgSpeed}</span>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1 h-7 px-3 rounded-lg bg-white/[0.08] text-white text-xs font-semibold"
                >
                  <span>Order</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
