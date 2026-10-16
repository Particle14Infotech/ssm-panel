"use client";

import React from "react";
import { landingContent } from "@/content/landing";
import {
  Wallet,
  Compass,
  Package,
  Server,
  CheckCircle2,
} from "lucide-react";
import { useMotionPreference } from "../motion/useMotionPreference";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { RevealOnScroll } from "../motion/RevealOnScroll";

export function WorkWalkthroughSection() {
  const { reduced, canRender3D } = useMotionPreference();

  const stepIcons = [
    <Wallet key="1" className="w-5 h-5 text-blue-400" />,
    <Compass key="2" className="w-5 h-5 text-blue-400" />,
    <Package key="3" className="w-5 h-5 text-blue-400" />,
    <Server key="4" className="w-5 h-5 text-blue-400" />,
    <CheckCircle2 key="5" className="w-5 h-5 text-blue-400" />,
  ];

  const fallbackLogos = [
    { name: "Instagram", id: "instagram" },
    { name: "YouTube", id: "youtube" },
    { name: "Telegram", id: "telegram" },
    { name: "TikTok", id: "tiktok" },
    { name: "Facebook", id: "facebook" },
    { name: "X", id: "x" },
  ];

  return (
    <section id="work" data-crown="right" className="w-full py-24 bg-transparent relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading & Subtext */}
        <RevealOnScroll className="max-w-3xl mb-16 relative">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 uppercase tracking-widest mb-4 backdrop-blur-md">
            {landingContent.workWalkthrough.badge}
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight mb-4">
            {landingContent.workWalkthrough.title}
          </h2>
          <p className="text-base sm:text-lg text-slate-300 font-light max-w-2xl bg-[#070B16]/60 border border-white/5 backdrop-blur-sm p-4 rounded-2xl">
            {landingContent.workWalkthrough.description}
          </p>
        </RevealOnScroll>

        {/* Static SVG Fallback for Reduced Motion or Non-WebGL */}
        {(reduced || !canRender3D) && (
          <div
            data-testid="static-pipeline-svg"
            className="w-full mb-12 p-8 rounded-2xl bg-[#070B16]/90 border border-white/[0.08] backdrop-blur-xl"
          >
            {/* 6 Platform Logos Row as Flat SVG */}
            <div className="flex flex-wrap items-center justify-center gap-4 mb-8 pb-6 border-b border-white/10">
              {fallbackLogos.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10"
                >
                  <PlatformIcon platform={item.id} size={16} />
                  <span className="text-xs font-mono text-slate-300 font-medium">{item.name}</span>
                </div>
              ))}
            </div>

            {/* 5 Steps Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div className="flex flex-col items-center p-4 rounded-xl bg-white/[0.04] border border-blue-500/20">
                <Wallet className="w-6 h-6 text-blue-400 mb-2" />
                <span className="font-mono text-sm font-semibold text-white">1 Add funds</span>
                <span className="text-xs text-slate-400 mt-1">Top up wallet</span>
              </div>
              <div className="flex flex-col items-center p-4 rounded-xl bg-white/[0.04] border border-blue-500/20">
                <Compass className="w-6 h-6 text-blue-400 mb-2" />
                <span className="font-mono text-sm font-semibold text-white">2 Choose service</span>
                <span className="text-xs text-slate-400 mt-1">Pick platform</span>
              </div>
              <div className="flex flex-col items-center p-4 rounded-xl bg-white/[0.04] border border-blue-500/20">
                <Package className="w-6 h-6 text-blue-400 mb-2" />
                <span className="font-mono text-sm font-semibold text-white">3 Place order</span>
                <span className="text-xs text-slate-400 mt-1">Link & quantity</span>
              </div>
              <div className="flex flex-col items-center p-4 rounded-xl bg-white/[0.04] border border-blue-500/20">
                <Server className="w-6 h-6 text-blue-400 mb-2" />
                <span className="font-mono text-sm font-semibold text-white">4 Provider delivers</span>
                <span className="text-xs text-slate-400 mt-1">API dispatch</span>
              </div>
              <div className="flex flex-col items-center p-4 rounded-xl bg-white/[0.04] border border-blue-500/20">
                <CheckCircle2 className="w-6 h-6 text-blue-400 mb-2" />
                <span className="font-mono text-sm font-semibold text-white">5 Complete</span>
                <span className="text-xs text-slate-400 mt-1">Track & refund</span>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Split Layout / Mobile Stack Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: 5 Step Cards */}
          <div className="lg:col-span-6 flex flex-col gap-5 z-10">
            {landingContent.workWalkthrough.steps.map((step, idx) => (
              <RevealOnScroll key={step.step} delay={idx * 0.08}>
                <div className="rounded-2xl p-6 bg-gradient-to-b from-white/[0.06] to-white/[0.02] bg-[#070B16]/80 border border-white/[0.08] hover:border-blue-500/40 backdrop-blur-xl relative flex flex-col justify-between transition-all duration-300 shadow-[0_20px_40px_rgba(0,0,0,0.5)] group">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xl font-bold text-slate-500 group-hover:text-blue-400 transition-colors">
                        {step.step}
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center backdrop-blur-md">
                        {stepIcons[idx]}
                      </div>
                    </div>

                    <span className="text-xs uppercase tracking-widest font-mono text-blue-400 font-medium block mb-1">
                      {step.tag}
                    </span>

                    <h3 className="font-heading text-lg font-medium text-white mb-2">
                      {step.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-300 font-light leading-relaxed mb-3">
                      {step.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/[0.08] text-[11px] text-slate-400 font-mono font-light">
                    {step.detail}
                  </div>
                </div>
              </RevealOnScroll>
            ))}
          </div>

          {/* Right Column: Dedicated viewport zone for persistent 3D crown stage */}
          <div className="hidden lg:block lg:col-span-6 h-full min-h-[580px] pointer-events-none relative">
            <div className="sticky top-28 w-full h-[520px] rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none flex items-center justify-center">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                Interactive Order Flow Visualizer
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
