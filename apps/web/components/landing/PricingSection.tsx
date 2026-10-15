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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-xs font-mono text-[#DBEF90] uppercase tracking-widest mb-4 backdrop-blur-md">
            {landingContent.pricingTiers.badge}
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight mb-4">
            {landingContent.pricingTiers.title}
          </h2>
          <p className="text-base text-zinc-300 font-light">
            {landingContent.pricingTiers.description}
          </p>
        </RevealOnScroll>

        {/* Pricing Deposit Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 items-stretch pt-6">
          {landingContent.pricingTiers.tiers.map((tier, idx) => (
            <RevealOnScroll key={tier.name} delay={idx * 0.1} className="h-full">
              <TiltCard
                maxTilt={5}
                glowColor={tier.recommended ? "rgba(216, 236, 141, 0.28)" : "rgba(255, 255, 255, 0.12)"}
                className={`h-full rounded-3xl p-8 flex flex-col justify-between relative shadow-[0_24px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-all duration-300 !overflow-visible ${
                  tier.recommended
                    ? "bg-gradient-to-b from-[#D8EC8D]/10 via-zinc-950/75 to-zinc-950/90 border-2 border-[#D8EC8D]/80 shadow-[0_0_40px_rgba(216,236,141,0.2)] md:-translate-y-3 z-20"
                    : "bg-gradient-to-b from-white/[0.08] to-white/[0.02] bg-zinc-950/60 border border-white/[0.14] hover:border-white/[0.28] hover:bg-zinc-950/75"
                }`}
              >
                {tier.recommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#D8EC8D] to-[#BEF264] text-zinc-950 text-[11px] font-mono font-bold uppercase tracking-widest shadow-[0_4px_20px_rgba(216,236,141,0.35)] z-30 ring-2 ring-zinc-950">
                    <span>Top Bonus Tier</span>
                  </div>
                )}

                <div>
                  <div className="mb-4">
                    <h3 className="font-heading text-2xl font-light text-white">{tier.name}</h3>
                    <p className="text-xs text-zinc-300 mt-1 font-light">{tier.description}</p>
                  </div>

                  <div className="my-6 pb-6 border-b border-white/[0.08]">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs text-zinc-400 font-mono">Min. Deposit:</span>
                      <span className="font-heading text-3xl sm:text-4xl font-light text-white">
                        {formatINR(tier.minDeposit, 0)}
                      </span>
                    </div>
                    {tier.bonusPercent > 0 && (
                      <div
                        className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold ${
                          tier.recommended
                            ? "bg-[#D8EC8D]/20 text-[#D8EC8D] border border-[#D8EC8D]/40"
                            : "bg-[#DBEF90]/15 text-[#DBEF90] border border-[#DBEF90]/20"
                        }`}
                      >
                        +{tier.bonusPercent}% Extra Wallet Credit
                      </div>
                    )}
                  </div>

                  <ul className="flex flex-col gap-3 mb-8">
                    {tier.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2.5 text-xs text-zinc-200">
                        <Check
                          className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                            tier.recommended ? "text-[#D8EC8D]" : "text-[#DBEF90]"
                          }`}
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <MagneticButton className="w-full">
                  <Link
                    href="/register"
                    className={`w-full py-3.5 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      tier.recommended
                        ? "bg-[#D8EC8D] text-zinc-950 shadow-[0_0_24px_rgba(216,236,141,0.3)] hover:bg-[#c7dc78]"
                        : "bg-white/[0.08] text-white hover:bg-white/[0.16] border border-white/[0.08]"
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
        <RevealOnScroll className="text-center text-xs text-zinc-300 font-mono">
          {landingContent.pricingTiers.note}
        </RevealOnScroll>
      </div>
    </section>
  );
}

