"use client";

import React, { useState } from "react";
import Link from "next/link";
import { landingContent } from "@/content/landing";
import { ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { Reveal } from "@/components/motion/Reveal";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export function ServicesPreviewSection() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const shouldReduceMotion = useReducedMotion();

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
    <section id="services" className="w-full py-14 md:py-[72px] lg:py-28 bg-[#131313] relative">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Title Block */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="max-w-[560px]">
            <Reveal delay={0.05}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
                <span className="text-[13px] font-medium text-[#d8ec8d]">
                  {landingContent.servicesPreview.badge}
                </span>
              </div>
            </Reveal>

            <SplitHeading
              as="h2"
              className="text-[clamp(30px,3.6vw,44px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-3"
            >
              {landingContent.servicesPreview.title}
            </SplitHeading>

            <Reveal delay={0.15}>
              <p className="text-base text-[#A1A1AA] font-normal leading-relaxed">
                {landingContent.servicesPreview.description}
              </p>
            </Reveal>

            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              className="w-24 h-[1px] bg-gradient-to-r from-[#d8ec8d]/50 to-transparent origin-left mt-6"
            />
          </div>

          <Reveal delay={0.25}>
            <Link
              href="/services"
              className="group text-sm font-semibold text-[#d8ec8d] hover:text-white flex items-center gap-1.5 transition-colors self-start md:self-auto"
            >
              <span>View all services</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Reveal>
        </div>

        {/* Platform Tabs with Shared Layout Animation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none relative">
          {platforms.map((p) => {
            const isSelected = selectedPlatform === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPlatform(p.id)}
                className={`relative px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 z-10 ${
                  isSelected ? "text-[#171e00]" : "text-[#A1A1AA] hover:text-white"
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="services-platform-tab"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    className="absolute inset-0 bg-[#d8ec8d] rounded-xl -z-10 shadow-sm"
                  />
                )}
                {p.id !== "ALL" && <PlatformIcon platform={p.id} size={14} />}
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop Table with Crossfading Rows */}
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
            <AnimatePresence mode="wait">
              <motion.tbody
                key={selectedPlatform}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="divide-y divide-white/[0.06] text-sm"
              >
                {filteredServices.map((service, i) => (
                  <motion.tr
                    key={service.id}
                    initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                    className="hover:bg-white/[0.03] transition-colors group"
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
                        className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-white/[0.06] hover:bg-[#d8ec8d] hover:text-[#171e00] text-xs font-semibold text-white transition-all group-hover:border-[#d8ec8d]/40"
                      >
                        <span>Order</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </AnimatePresence>
          </table>
        </div>

        {/* Mobile Compact Cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`mobile-${selectedPlatform}`}
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
            transition={{ duration: 0.25 }}
            className="md:hidden flex flex-col gap-3"
          >
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className="rounded-[16px] p-4 border border-white/[0.08] bg-white/[0.02] flex flex-col gap-3 hover:border-white/[0.16] transition-colors"
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
                    className="inline-flex items-center gap-1 h-7 px-3 rounded-lg bg-white/[0.08] text-white text-xs font-semibold hover:bg-[#d8ec8d] hover:text-[#171e00] transition-colors"
                  >
                    <span>Order</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
