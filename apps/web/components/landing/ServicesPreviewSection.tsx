"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { landingContent } from "@/content/landing";
import { ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { Reveal } from "@/components/motion/Reveal";
import { CrownSlot } from "@/components/three/CrownSlot";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export function ServicesPreviewSection() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const shouldReduceMotion = useReducedMotion();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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

  // Auto-scroll active tab into view smoothly
  useEffect(() => {
    const el = tabRefs.current[selectedPlatform];
    if (el) {
      el.scrollIntoView({
        behavior: shouldReduceMotion ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedPlatform, shouldReduceMotion]);

  return (
    <section
      id="services"
      className="w-full py-14 sm:py-20 lg:py-28 bg-[#131313] relative"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Title Block with reserved CrownSlot on the right */}
        <div className="flex items-start justify-between gap-4 mb-8 md:mb-12">
          <div className="max-w-[560px] text-left">
            <Reveal delay={0.05}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
                <span className="text-[13px] font-medium text-[#d8ec8d]">
                  {landingContent.servicesPreview.badge}
                </span>
              </div>
            </Reveal>

            <SplitHeading
              as="h2"
              className="text-[clamp(28px,3.6vw,44px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-3"
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
            <Reveal delay={0.25} className="hidden sm:block mt-6">
              <Link
                href="/services"
                className="group text-sm font-semibold text-[#d8ec8d] hover:text-white inline-flex items-center min-h-[44px] gap-1.5 transition-colors"
              >
                <span>View all services in full catalog</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Reveal>
          </div>

          <div className="flex flex-col items-end shrink-0">
            {/* Reserved docking slot beside heading / side gutter: never inside text column */}
            <CrownSlot
              id="services"
              className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 lg:w-36 lg:h-36 xl:translate-x-16 2xl:translate-x-28"
            />
          </div>
        </div>

        {/* Platform Tabs: Edge fade masks on desktop, wrapped within safe left corridor on mobile */}
        <div className="relative mb-8 pr-16 xl:pr-0">
          {/* Edge fade masks on horizontal scrolling desktop/tablet */}
          <div className="hidden sm:block absolute left-0 top-0 bottom-2 w-8 bg-gradient-to-r from-[#131313] to-transparent z-20 pointer-events-none" />
          <div className="hidden sm:block absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-[#131313] to-transparent z-20 pointer-events-none" />

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 max-w-[290px] sm:max-w-none sm:overflow-x-auto pb-3 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:snap-x sm:snap-mandatory px-1 md:pr-1">
            {platforms.map((p) => {
              const isSelected = selectedPlatform === p.id;
              return (
                <button
                  key={p.id}
                  ref={(el) => {
                    tabRefs.current[p.id] = el;
                  }}
                  type="button"
                  onClick={() => setSelectedPlatform(p.id)}
                  className={`relative h-11 min-h-[44px] px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 sm:gap-2 z-10 shrink-0 sm:snap-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8ec8d] ${
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
                  {p.id !== "ALL" && <PlatformIcon platform={p.id} size={15} />}
                  <span>
                    {p.id === "ALL" ? (
                      <>
                        <span className="sm:hidden">All</span>
                        <span className="hidden sm:inline">All Platforms</span>
                      </>
                    ) : (
                      p.label
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tablet & Desktop Table (md+) */}
        <div className="hidden md:block rounded-[20px] border border-white/[0.08] bg-white/[0.02] overflow-hidden mr-16 xl:mr-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] text-xs font-medium text-[#A1A1AA]">
                <th className="py-4 px-6">Service</th>
                <th className="py-4 px-6">Rate / 1,000</th>
                <th className="py-4 px-6">Min – Max</th>
                <th className="py-4 px-6">Start Time</th>
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
                        className="inline-flex items-center gap-1.5 h-11 min-h-[44px] px-5 rounded-xl bg-white/[0.06] hover:bg-[#d8ec8d] hover:text-[#171e00] text-xs font-semibold text-white transition-all group-hover:border-[#d8ec8d]/40 focus-visible:ring-2 focus-visible:ring-[#d8ec8d]"
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

        {/* Phone Stacked Cards (< md): Rate large, Order button >= 44px, min-max and start time visible */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`mobile-${selectedPlatform}`}
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
            transition={{ duration: 0.25 }}
            className="md:hidden flex flex-col gap-3.5 pr-16 sm:pr-0"
          >
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className="rounded-[18px] p-4 border border-white/[0.08] bg-white/[0.02] flex flex-col gap-3 hover:border-white/[0.16] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={service.platform} size={18} />
                    <span className="text-sm font-semibold text-white leading-snug">
                      {service.serviceName}
                    </span>
                  </div>
                  {/* Large Rate */}
                  <span className="text-base font-bold tabular-nums text-[#d8ec8d] shrink-0">
                    {formatINR(service.ratePer1000, 2)}
                  </span>
                </div>

                {/* Min-Max, Start Time and Order Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#A1A1AA] gap-3 pt-2.5 border-t border-white/[0.06]">
                  <div className="flex flex-col gap-0.5">
                    <span>
                      Min: <strong className="text-white font-mono">{service.minQty.toLocaleString("en-US")}</strong> · Max: <strong className="text-white font-mono">{service.maxQty.toLocaleString("en-US")}</strong>
                    </span>
                    <span>Start: <span className="text-white">{service.avgSpeed}</span></span>
                  </div>

                  <div className="self-start sm:self-auto">
                    <Link
                      href="/register"
                      className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-6 rounded-xl bg-[#d8ec8d] text-[#171e00] text-xs font-semibold hover:brightness-105 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[#d8ec8d]"
                    >
                      <span>Order</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        <div className="sm:hidden mt-6 text-center pr-16 sm:pr-0">
          <Link
            href="/services"
            className="text-xs font-semibold text-[#d8ec8d] inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] gap-1.5 active:scale-95 transition-all"
          >
            <span>View all services in full catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
