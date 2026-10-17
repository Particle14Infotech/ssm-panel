"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CrownSlot } from "@/components/three/CrownSlot";
import {
  Wallet,
  Layers,
  Send,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Zap,
  ArrowRight,
  Search,
  Check,
  Clock,
  Sparkles,
  CreditCard,
  QrCode,
  TrendingUp,
} from "lucide-react";

// Step 01: Add Funds Screen Preview
function Step01AddFundsScreen() {
  return (
    <div className="w-full h-full p-4 sm:p-5 flex flex-col justify-between bg-[#131313] text-white select-none">
      {/* Top bar with wallet balance */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div>
          <span className="text-[11px] font-mono uppercase text-[#A1A1AA] tracking-wider block">
            Wallet Liquidity
          </span>
          <span className="text-lg sm:text-xl font-bold font-mono text-white">
            ₹2,450.00 <span className="text-xs font-normal text-[#A1A1AA]">INR</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#d8ec8d]/10 border border-[#d8ec8d]/20 text-[#d8ec8d] text-xs font-medium">
          <Zap className="w-3 h-3" />
          <span>Instant Credit</span>
        </div>
      </div>

      {/* Payment methods */}
      <div className="my-3">
        <label className="text-xs font-medium text-[#A1A1AA] mb-2 block">
          Choose Deposit Method
        </label>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 sm:p-2.5 rounded-xl bg-white/[0.06] border border-[#d8ec8d]/50 flex flex-col items-center justify-center text-center shadow-[0_0_12px_rgba(216,236,141,0.1)]">
            <div className="w-6 h-6 rounded-lg bg-[#d8ec8d]/20 flex items-center justify-center mb-1 text-[#d8ec8d]">
              <QrCode className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-white">UPI QR</span>
            <span className="text-[10px] text-[#d8ec8d] font-mono">0% Fee • 5s</span>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col items-center justify-center text-center opacity-70">
            <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center mb-1 text-white/80">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-medium text-white">Cards</span>
            <span className="text-[10px] text-[#A1A1AA] font-mono">Visa / RuPay</span>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col items-center justify-center text-center opacity-70">
            <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center mb-1 text-white/80">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-medium text-white">Netbanking</span>
            <span className="text-[10px] text-[#A1A1AA] font-mono">All Banks</span>
          </div>
        </div>
      </div>

      {/* Deposit Amount Field & Presets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#A1A1AA]">Deposit Amount</span>
          <span className="text-[#d8ec8d] font-mono">+10% Tier Bonus Active</span>
        </div>
        <div className="h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.1] flex items-center justify-between">
          <span className="font-mono text-base font-semibold text-white">₹ 1,000</span>
          <span className="text-xs font-mono text-[#A1A1AA]">INR</span>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          {["₹200", "₹500", "₹1,000", "₹5,000"].map((preset, i) => (
            <span
              key={preset}
              className={`flex-1 py-1 text-center rounded-lg text-[11px] font-mono border ${
                i === 2
                  ? "bg-[#d8ec8d]/15 border-[#d8ec8d]/40 text-[#d8ec8d] font-semibold"
                  : "bg-white/[0.02] border-white/[0.06] text-[#A1A1AA]"
              }`}
            >
              {preset}
            </span>
          ))}
        </div>
      </div>

      {/* Action button */}
      <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
        <div className="text-[11px] text-[#A1A1AA] flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-[#d8ec8d]" />
          <span>256-bit encrypted gateway</span>
        </div>
        <div
          role="presentation"
          className="h-9 px-4 rounded-xl bg-[#d8ec8d] text-[#171e00] font-semibold text-xs flex items-center gap-1.5 shadow-sm select-none"
        >
          <span>Top Up ₹1,000</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}

// Step 02: Choose Service Screen Preview
function Step02ChooseServiceScreen() {
  return (
    <div className="w-full h-full p-4 sm:p-5 flex flex-col justify-between bg-[#131313] text-white select-none">
      {/* Top search & platform filters */}
      <div>
        <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-white/[0.08]">
          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#d8ec8d]" />
            Live Service Catalog (500+ Active)
          </span>
          <span className="text-[11px] font-mono text-[#d8ec8d] bg-[#d8ec8d]/10 px-2 py-0.5 rounded-full border border-[#d8ec8d]/20">
            Transparent INR Rates
          </span>
        </div>

        {/* Platform tabs */}
        <div className="flex items-center gap-1.5 mb-2.5 overflow-hidden">
          {["Instagram", "YouTube", "Telegram", "TikTok"].map((platform, i) => (
            <span
              key={platform}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                i === 0
                  ? "bg-[#d8ec8d] text-[#171e00] border-[#d8ec8d] font-semibold shadow-sm"
                  : "bg-white/[0.03] text-white/70 border-white/[0.06]"
              }`}
            >
              {platform}
            </span>
          ))}
        </div>
      </div>

      {/* Services List with transparent rates */}
      <div className="space-y-2 flex-1 my-1 overflow-hidden">
        {[
          {
            name: "Instagram Followers [High Quality • 30D Refill]",
            rate: "₹65.00",
            min: "100",
            max: "100k",
            speed: "Instant",
            badge: "Best Seller",
            selected: true,
          },
          {
            name: "Instagram Reels Views [High Retention • Viral Push]",
            rate: "₹24.00",
            min: "500",
            max: "5M",
            speed: "0-5 min",
            badge: "Super Fast",
            selected: false,
          },
          {
            name: "Instagram Post Likes [Real Active Profiles]",
            rate: "₹38.00",
            min: "50",
            max: "50k",
            speed: "0-2 min",
            badge: "Guaranteed",
            selected: false,
          },
        ].map((svc) => (
          <div
            key={svc.name}
            className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
              svc.selected
                ? "bg-white/[0.06] border-[#d8ec8d]/50 shadow-[0_0_12px_rgba(216,236,141,0.06)]"
                : "bg-white/[0.02] border-white/[0.05]"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs font-medium text-white truncate block">
                  {svc.name}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-[#d8ec8d] shrink-0 border border-white/[0.08]">
                  {svc.badge}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono text-[#A1A1AA]">
                <span>Min: {svc.min}</span>
                <span>Max: {svc.max}</span>
                <span className="text-white/60">Start: {svc.speed}</span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs font-bold font-mono text-[#d8ec8d]">
                {svc.rate}
              </div>
              <div className="text-[10px] text-[#A1A1AA] font-mono">per 1,000</div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="pt-2.5 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-[#A1A1AA]">
        <span>Upfront wholesale rates. No hidden API markups.</span>
        <span className="text-[#d8ec8d] font-mono flex items-center gap-1">
          <span>Active & Validated</span>
          <Check className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}

// Step 03: Place Order Screen Preview
function Step03PlaceOrderScreen() {
  return (
    <div className="w-full h-full p-4 sm:p-5 flex flex-col justify-between bg-[#131313] text-white select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div>
          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-[#d8ec8d]" />
            New Order Configuration
          </span>
          <span className="text-[11px] text-[#A1A1AA]">
            Instant automated queue dispatch
          </span>
        </div>
        <span className="text-[11px] font-mono text-white/70 bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/[0.08]">
          Instagram / Followers
        </span>
      </div>

      {/* Form Fields */}
      <div className="space-y-2.5 my-2">
        {/* Destination Link */}
        <div>
          <label className="text-xs font-medium text-[#A1A1AA] mb-1 flex items-center justify-between">
            <span>Destination Link / Target Handle</span>
            <span className="text-[10px] font-mono text-[#d8ec8d]">Verified Public</span>
          </label>
          <div className="h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.1] flex items-center">
            <span className="font-mono text-xs text-white/90 truncate">
              https://instagram.com/mycreativestudio
            </span>
          </div>
        </div>

        {/* Quantity selector */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[#A1A1AA]">Desired Quantity</span>
            <span className="font-mono text-white font-semibold">2,500 units</span>
          </div>
          <div className="h-9 px-3 rounded-xl bg-white/[0.04] border border-[#d8ec8d]/40 flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-[#d8ec8d]">2500</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-white/80">
                Min 100
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-white/80">
                Max 100k
              </span>
            </div>
          </div>
        </div>

        {/* Live Calculation Callout */}
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] font-mono text-[#A1A1AA] uppercase block">
              Calculated Total (₹65/1k)
            </span>
            <span className="text-base font-bold font-mono text-[#d8ec8d]">
              ₹ 162.50 <span className="text-xs font-normal text-[#A1A1AA]">INR</span>
            </span>
          </div>
          <div className="text-right font-mono text-[11px] text-[#A1A1AA]">
            <span>Wallet After: </span>
            <span className="text-white">₹2,287.50</span>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2.5 border-t border-white/[0.08] flex items-center justify-between">
        <span className="text-[11px] text-[#A1A1AA] flex items-center gap-1">
          <Clock className="w-3 h-3 text-[#d8ec8d]" />
          <span>Dispatches in &lt; 30 seconds</span>
        </span>
        <div
          role="presentation"
          className="h-9 px-4 rounded-xl bg-[#d8ec8d] text-[#171e00] font-semibold text-xs flex items-center gap-1.5 shadow-sm select-none"
        >
          <span>Confirm Order</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}

// Step 04: Track and Refunds Screen Preview
function Step04TrackRefundsScreen() {
  return (
    <div className="w-full h-full p-4 sm:p-5 flex flex-col justify-between bg-[#131313] text-white select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div>
          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5 text-[#d8ec8d]" />
            Live Orders & Automated Refunds
          </span>
          <span className="text-[11px] text-[#A1A1AA]">
            Real-time status synced via provider WebHooks
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#d8ec8d]">
          <span className="w-2 h-2 rounded-full bg-[#d8ec8d] animate-pulse" />
          <span>Live Sync</span>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-2 my-2 flex-1 overflow-hidden">
        {/* Order 1: In Progress */}
        <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08]">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold font-mono text-white">#ORD-94821</span>
              <span className="text-[11px] text-[#A1A1AA] truncate">Instagram Followers</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#d8ec8d]/15 text-[#d8ec8d] border border-[#d8ec8d]/30 font-medium">
              In Progress
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-white/[0.08] h-1.5 rounded-full overflow-hidden mb-1.5">
            <div className="bg-[#d8ec8d] h-full rounded-full w-[74%]" />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-[#A1A1AA]">
            <span>Delivered: 1,850 / 2,500</span>
            <span className="text-[#d8ec8d]">74% complete</span>
          </div>
        </div>

        {/* Order 2: Automated Refund Triggered */}
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-amber-400/30 bg-amber-400/[0.02]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold font-mono text-white">#ORD-94750</span>
              <span className="text-[11px] text-[#A1A1AA] truncate">Telegram Members</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 font-medium">
              Partial Refunded
            </span>
          </div>
          <div className="text-[11px] text-amber-200/90 flex items-center gap-1.5 mt-1">
            <RotateCcw className="w-3 h-3 text-amber-400 shrink-0" />
            <span>₹45.00 automatically returned to wallet for unfulfilled quota</span>
          </div>
        </div>

        {/* Order 3: Completed */}
        <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-white/70">#ORD-94692</span>
            <span className="text-[11px] text-[#A1A1AA]">YouTube 4K Views (10,000)</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-white/80 border border-white/[0.1]">
            Completed
          </span>
        </div>
      </div>

      {/* Footer Guarantee */}
      <div className="pt-2.5 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-[#A1A1AA]">
        <span>Zero funds lost. Unfulfilled counts credit automatically.</span>
        <span className="font-mono text-white/60">Updated 10s ago</span>
      </div>
    </div>
  );
}

const STEPS = [
  {
    num: "01",
    total: "04",
    title: "Add funds",
    sentence: "Top up your wallet in INR using UPI, cards, or netbanking with instant credit.",
    icon: Wallet,
    detail: "Min. deposit ₹100 via UPI & cards",
    component: Step01AddFundsScreen,
  },
  {
    num: "02",
    total: "04",
    title: "Choose a service",
    sentence: "Select your platform and service with transparent rates per 1,000 shown upfront.",
    icon: Layers,
    detail: "Clear rate per 1k, min/max limits",
    component: Step02ChooseServiceScreen,
  },
  {
    num: "03",
    total: "04",
    title: "Place your order",
    sentence: "Enter your destination link, adjust your desired quantity, and confirm in one click.",
    icon: Send,
    detail: "Instant validation & order queuing",
    component: Step03PlaceOrderScreen,
  },
  {
    num: "04",
    total: "04",
    title: "Track and get refunds",
    sentence: "Follow order progress live; unfulfilled amounts automatically return to your wallet.",
    icon: RotateCcw,
    detail: "Live progress & automated refunds",
    component: Step04TrackRefundsScreen,
  },
];

export function WorkWalkthroughSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-advance step every 6s unless hovered/interacted
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const current = STEPS[activeStep];
  const ActiveScreenComponent = current.component;

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
                    Live UI Preview
                  </div>
                </div>
              </div>

              {/* Screen Preview Frame: Crisp, reactive, authentic mock UI */}
              <div className="relative min-h-[340px] sm:min-h-[380px] w-full rounded-2xl overflow-hidden bg-[#131313] border border-white/[0.08]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.num}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 1.02 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0 overflow-y-auto"
                  >
                    <ActiveScreenComponent />
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

