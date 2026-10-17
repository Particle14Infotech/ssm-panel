"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { landingContent } from "@/content/landing";
import { ArrowRight, Calculator, Clock, Sparkles } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { CrownSlot } from "@/components/three/CrownSlot";
import { motion, AnimatePresence } from "framer-motion";

export function ServicesPreviewSection() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("INSTAGRAM");
  const services = landingContent.servicesPreview.items;

  const platforms = [
    { id: "INSTAGRAM", label: "Instagram" },
    { id: "YOUTUBE", label: "YouTube" },
    { id: "TIKTOK", label: "TikTok" },
    { id: "TELEGRAM", label: "Telegram" },
    { id: "X_TWITTER", label: "X" },
  ];

  const availableServices = useMemo(() => {
    return services.filter((s) => s.platform === selectedPlatform);
  }, [services, selectedPlatform]);

  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    availableServices[0]?.id || ""
  );

  useEffect(() => {
    if (availableServices.length > 0) {
      setSelectedServiceId(availableServices[0].id);
    }
  }, [selectedPlatform, availableServices]);

  const activeService = useMemo(() => {
    return (
      availableServices.find((s) => s.id === selectedServiceId) ||
      availableServices[0]
    );
  }, [availableServices, selectedServiceId]);

  const [quantity, setQuantity] = useState<number>(1000);

  useEffect(() => {
    if (activeService) {
      const defaultQty = Math.max(
        activeService.minQty,
        Math.min(1000, activeService.maxQty)
      );
      setQuantity(defaultQty);
    }
  }, [activeService]);

  const totalPrice = useMemo(() => {
    if (!activeService) return 0;
    return (activeService.ratePer1000 * quantity) / 1000;
  }, [activeService, quantity]);

  return (
    <section
      id="pricing"
      className="w-full py-16 sm:py-24 lg:py-28 bg-transparent relative"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-xl text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
              <span className="w-2 h-2 rounded-full bg-[#d8ec8d]" />
              <span className="text-[13px] font-medium text-[#d8ec8d]">
                Instant Estimate
              </span>
            </div>
            <h2 className="text-[clamp(28px,3.8vw,48px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-4">
              Live price calculator
            </h2>
            <p className="text-base sm:text-lg text-[#A1A1AA] font-normal leading-relaxed">
              Calculate exact INR prices for any service before ordering. No hidden fees, instant dispatch.
            </p>
          </div>

          <div className="hidden lg:flex items-center justify-end">
            <CrownSlot
              id="services"
              className="w-28 h-28 pointer-events-none"
            />
          </div>
        </div>

        {/* Empty state safeguard */}
        {services.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#1c1b1b]/80 border border-white/[0.08]">
            <p className="text-lg text-white/80">Services opening soon</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 Columns: Calculator Interface */}
            <div className="lg:col-span-7 bg-[#1c1b1b]/80 border border-white/[0.12] backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-6">
              {/* 1. Platform Tabs */}
              <div>
                <label className="text-xs uppercase tracking-widest text-[#A1A1AA] font-mono block mb-3">
                  1. Select Platform
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {platforms.map((p) => {
                    const isSelected = selectedPlatform === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPlatform(p.id)}
                        className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8ec8d] ${
                          isSelected
                            ? "bg-[#d8ec8d] text-[#171e00] font-semibold shadow-sm"
                            : "bg-white/[0.03] text-white/80 hover:bg-white/[0.06] hover:text-white border border-white/[0.08]"
                        }`}
                      >
                        <PlatformIcon platform={p.id} size={16} />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Service Select */}
              {activeService && (
                <div>
                  <label className="text-xs uppercase tracking-widest text-[#A1A1AA] font-mono block mb-3">
                    2. Choose Service
                  </label>
                  <div className="flex flex-col gap-2">
                    {availableServices.map((s) => {
                      const isSelected = s.id === activeService.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedServiceId(s.id)}
                          className={`w-full min-h-[48px] p-3.5 rounded-xl text-left border transition-all flex items-center justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8ec8d] ${
                            isSelected
                              ? "bg-white/[0.08] border-[#d8ec8d]/50 text-white shadow-sm"
                              : "bg-white/[0.02] border-white/[0.06] text-white/70 hover:bg-white/[0.04] hover:text-white"
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-white">
                              {s.serviceName}
                            </span>
                            <span className="text-xs text-[#A1A1AA] font-mono mt-0.5">
                              Min: {s.minQty.toLocaleString("en-IN")} · Max: {s.maxQty.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-sm font-semibold text-[#d8ec8d] font-mono">
                              {formatINR(s.ratePer1000)}
                            </span>
                            <span className="text-xs text-[#A1A1AA] block">
                              per 1,000
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Quantity Slider & Input */}
              {activeService && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs uppercase tracking-widest text-[#A1A1AA] font-mono">
                      3. Quantity
                    </label>
                    <span className="text-xs font-mono text-[#d8ec8d]">
                      {quantity.toLocaleString("en-IN")} units
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={activeService.minQty}
                      max={activeService.maxQty}
                      step={Math.max(10, Math.floor(activeService.minQty / 2))}
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="w-full min-h-[44px] h-11 py-3 bg-transparent cursor-pointer accent-[#d8ec8d] focus:outline-none"
                      aria-label="Service quantity slider"
                    />
                    <input
                      type="number"
                      min={activeService.minQty}
                      max={activeService.maxQty}
                      value={quantity}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setQuantity(
                          Math.max(
                            activeService.minQty,
                            Math.min(val, activeService.maxQty)
                          )
                        );
                      }}
                      className="w-28 min-h-[44px] px-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-right font-mono text-sm focus:outline-none focus:border-[#d8ec8d]"
                      aria-label="Exact quantity input"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right 5 Columns: Price Summary Card */}
            {activeService && (
              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="bg-[#1c1b1b]/90 border border-white/[0.14] rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl flex flex-col justify-between relative overflow-hidden">
                  {/* Subtle lime glow accent */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#d8ec8d]/10 blur-3xl pointer-events-none rounded-full" />

                  <div>
                    <span className="text-xs uppercase tracking-widest text-[#A1A1AA] font-mono block mb-2">
                      Total Estimated Price
                    </span>
                    <div className="text-4xl sm:text-5xl font-bold text-white font-mono tracking-tight my-2">
                      {formatINR(totalPrice)}
                    </div>
                    <div className="text-xs text-[#A1A1AA] flex items-center gap-2 mt-3">
                      <Clock className="w-3.5 h-3.5 text-[#d8ec8d]" />
                      <span>Speed: {activeService.avgSpeed}</span>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-white/[0.08] flex flex-col gap-3">
                    <Link
                      href="/register"
                      className="w-full min-h-[48px] px-6 rounded-xl bg-[#d8ec8d] text-[#171e00] font-semibold text-sm hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                      <span>Create account to order</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    <Link
                      href="/services"
                      className="w-full min-h-[44px] px-4 rounded-xl text-center text-xs text-[#A1A1AA] hover:text-white transition-colors flex items-center justify-center"
                    >
                      View all services in full catalog →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
