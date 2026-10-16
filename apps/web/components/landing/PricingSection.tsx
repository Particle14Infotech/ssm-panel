"use client";

import React from "react";
import Link from "next/link";
import { landingContent } from "@/content/landing";
import { Check, ArrowRight } from "lucide-react";
import { TiltCard } from "@/components/motion/TiltCard";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { formatINR } from "@/lib/utils";

export function PricingSection() {
  return (
    <section id="pricing" data-crown="dim" className="w-full py-24 bg-transparent relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealOnScroll className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 uppercase tracking-widest mb-4 backdrop-blur-md">
            {landingContent.pricingTiers.badge}
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight mb-4">
            {landingContent.pricingTiers.title}
          </h2>
          <p className="text-base text-slate-300 font-light">
            {landingContent.pricingTiers.description}
          </p>
        </RevealOnScroll>

        {/* Pricing Deposit Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 items-stretch pt-6">
          {landingContent.pricingTiers.tiers.map((tier, idx) => (
            <RevealOnScroll key={tier.name} delay={idx * 0.1} className="h-full">
              <TiltCard
                maxTilt={4}
                glowColor={tier.recommended ? "rgba(37, 99, 235, 0.25)" : "rgba(255, 255, 255, 0.08)"}
                className={`h-full rounded-2xl p-8 flex flex-col justify-between relative shadow-[0_20px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300 !overflow-visible ${
                  tier.recommended
                    ? "bg-gradient-to-b from-blue-600/15 via-[#070B16]/90 to-[#070B16] border-2 border-blue-500/70 shadow-[0_0_40px_rgba(37,99,235,0.2)] md:-translate-y-2 z-20"
                    : "bg-gradient-to-b from-white/[0.06] to-white/[0.02] bg-[#070B16]/80 border border-white/[0.08] hover:border-white/[0.2]"
                }`}
              >
                {tier.recommended && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-blue-600 text-white text-[11px] font-mono font-semibold uppercase tracking-wider shadow-lg shadow-blue-600/30 z-30 ring-2 ring-[#02040A]">
                    <span>Top Bonus Tier</span>
                  </div>
                )}

                <div>
                  <div className="mb-4">
                    <h3 className="font-heading text-2xl font-light text-white">{tier.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 font-light">{tier.description}</p>
                  </div>

                  <div className="my-6 pb-6 border-b border-white/[0.08]">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs text-slate-400 font-mono">Min. Deposit:</span>
                      <span className="font-heading text-3xl sm:text-4xl font-light text-white font-sans tabular-nums font-semibold tracking-tight">
                        {formatINR(tier.minDeposit, 0)}
                      </span>
                    </div>
                    {tier.bonusPercent > 0 && (
                      <div className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        +{tier.bonusPercent}% Extra Wallet Credit
                      </div>
                    )}
                  </div>

                  <ul className="flex flex-col gap-3 mb-8">
                    {tier.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2.5 text-xs text-slate-200">
                        <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <MagneticButton className="w-full">
                  <Link
                    href="/register"
                    className={`w-full py-3.5 rounded-full text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      tier.recommended
                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25"
                        : "bg-white/[0.06] text-white hover:bg-white/[0.12] border border-white/[0.08]"
                    }`}
                  >
                    <span>Deposit & Get Started</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </MagneticButton>
              </TiltCard>
            </RevealOnScroll>
          ))}
        </div>

        {/* Note */}
        <RevealOnScroll className="text-center text-xs text-slate-400 font-mono">
          {landingContent.pricingTiers.note}
        </RevealOnScroll>
      </div>
    </section>
  );
}
