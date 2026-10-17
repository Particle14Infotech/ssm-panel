"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { CrownSlot } from "@/components/three/CrownSlot";
import { Wallet, Layers, Send, RotateCcw, CheckCircle2, ShieldCheck, Zap } from "lucide-react";

const STEPS = [
  {
    num: "01",
    total: "04",
    title: "Add funds",
    sentence: "Top up your wallet in INR using UPI, cards, or netbanking with instant credit.",
    previewSrc: "/previews/preview-add-funds.png",
    alt: "Add funds preview",
    icon: Wallet,
    detail: "Min. deposit ₹100 via UPI & cards",
  },
  {
    num: "02",
    total: "04",
    title: "Choose a service",
    sentence: "Select your platform and service with transparent rates per 1,000 shown upfront.",
    previewSrc: "/previews/preview-choose-service.png",
    alt: "Choose service preview",
    icon: Layers,
    detail: "Clear rate per 1k, min/max limits",
  },
  {
    num: "03",
    total: "04",
    title: "Place your order",
    sentence: "Enter your destination link, adjust your desired quantity, and confirm in one click.",
    previewSrc: "/previews/preview-place-order.png",
    alt: "Place order preview",
    icon: Send,
    detail: "Instant validation & order queuing",
  },
  {
    num: "04",
    total: "04",
    title: "Track and get refunds",
    sentence: "Follow order progress live; unfulfilled amounts automatically return to your wallet.",
    previewSrc: "/previews/preview-track-order.png",
    alt: "Track order preview",
    icon: RotateCcw,
    detail: "Live progress & automated refunds",
  },
];

export function WorkWalkthroughSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-advance step every 5s unless hovered/interacted
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const current = STEPS[activeStep];

  return (
    <section
      id="work"
      className="w-full py-16 sm:py-24 lg:py-28 bg-transparent relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-xl text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
              <span className="w-2 h-2 rounded-full bg-[#d8ec8d]" />
              <span className="text-[13px] font-medium text-[#d8ec8d]">
                02 / 05 — How It Works
              </span>
            </div>
            <h2 className="text-[clamp(28px,3.8vw,48px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-4">
              Four simple steps
            </h2>
            <p className="text-base sm:text-lg text-[#A1A1AA] font-normal leading-relaxed">
              Get started in minutes with transparent pricing, instant INR deposits, and automated live order tracking.
            </p>
          </div>

          <div className="hidden lg:flex items-center justify-end">
            <CrownSlot
              id="steps"
              className="w-28 h-28 pointer-events-none"
            />
          </div>
        </div>

        {/* Dual Column Layout: Left = Step selector cards, Right = Interactive live preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column (Step Selector Cards: 5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            {STEPS.map((s, idx) => {
              const isSelected = activeStep === idx;
              const Icon = s.icon;

              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setActiveStep(idx)}
                  className={`w-full min-h-[48px] p-4 sm:p-5 rounded-2xl text-left border transition-all duration-300 flex items-start gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8ec8d] ${
                    isSelected
                      ? "bg-white/[0.05] border-[#d8ec8d]/50 shadow-[0_4px_20px_rgba(216,236,141,0.06)]"
                      : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.03] hover:border-white/[0.12]"
                  }`}
                >
                  {/* Step Number Badge */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono text-xs font-bold shrink-0 transition-colors ${
                      isSelected
                        ? "bg-[#d8ec8d] text-[#171e00] shadow-sm"
                        : "bg-white/[0.04] text-white/70 border border-white/[0.08]"
                    }`}
                  >
                    {s.num}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-base font-semibold text-white truncate">
                        {s.title}
                      </h3>
                      {isSelected && (
                        <span className="text-[11px] font-mono text-[#d8ec8d] px-2 py-0.5 rounded-full bg-[#d8ec8d]/10 shrink-0">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-[#A1A1AA] font-normal leading-relaxed line-clamp-2">
                      {s.sentence}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column (Glass Preview Panel: 7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center relative">
            <div className="w-full rounded-3xl bg-[#1c1b1b]/90 border border-white/[0.14] backdrop-blur-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#A1A1AA]">
                    Step {current.num} / {current.total}: {current.title}
                  </span>
                  <div className="text-[11px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-white/80">
                    Preview
                  </div>
                </div>
              </div>

              {/* Screen Preview Frame */}
              <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-[#131313] border border-white/[0.08]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.num}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={current.previewSrc}
                      alt={current.alt}
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 768px) 100vw, 700px"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Bottom detail pill */}
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#A1A1AA]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#d8ec8d]" />
                  <span>{current.detail}</span>
                </div>
                <span className="font-mono text-white/50">Auto-updates</span>
              </div>
            </div>
          </div>

        </div>

        {/* Workflow Guarantee Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-8 border-t border-white/[0.08]">
          <div className="h-12 min-h-[44px] flex items-center gap-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <Zap className="w-4 h-4 text-[#d8ec8d] shrink-0" />
            <span className="text-xs sm:text-sm text-white/80">Instant UPI & Card Deposit</span>
          </div>
          <div className="h-12 min-h-[44px] flex items-center gap-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <ShieldCheck className="w-4 h-4 text-[#d8ec8d] shrink-0" />
            <span className="text-xs sm:text-sm text-white/80">Automated Dispatch &lt; 60s</span>
          </div>
          <div className="h-12 min-h-[44px] flex items-center gap-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <RotateCcw className="w-4 h-4 text-[#d8ec8d] shrink-0" />
            <span className="text-xs sm:text-sm text-white/80">100% Wallet Balance Protection</span>
          </div>
        </div>

      </div>
    </section>
  );
}
