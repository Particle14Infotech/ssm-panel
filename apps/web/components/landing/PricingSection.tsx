import React from "react";
import Link from "next/link";
import { landingContent } from "@/content/landing";
import { Check, ArrowRight, Sparkles } from "lucide-react";

export function PricingSection() {
  return (
    <section id="pricing" className="w-full py-24 bg-[#0e0e0e] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1c1b1b] border border-white/10 text-xs font-mono text-[#d8ec8d] uppercase tracking-widest mb-4">
            {landingContent.pricingTiers.badge}
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight mb-4">
            {landingContent.pricingTiers.title}
          </h2>
          <p className="text-base text-[#c7c8b6] font-light">
            {landingContent.pricingTiers.description}
          </p>
        </div>

        {/* Pricing Deposit Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {landingContent.pricingTiers.tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-3xl p-8 flex flex-col justify-between relative transition-all duration-300 shadow-2xl ${
                tier.recommended
                  ? "bg-gradient-to-b from-[#1c1b1b] via-[#201f1f] to-[#1c1b1b] border-2 border-[#d8ec8d] shadow-[0_0_40px_rgba(216,236,141,0.15)] scale-105 z-10"
                  : "bg-[#1c1b1b]/80 border border-white/10 hover:border-white/20"
              }`}
            >
              {tier.recommended && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#d8ec8d] text-[#171e00] text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
                  <Sparkles className="w-3.5 h-3.5" />
                  Most Popular
                </div>
              )}

              <div>
                <div className="mb-4">
                  <h3 className="font-heading text-2xl font-light text-white">{tier.name}</h3>
                  <p className="text-xs text-[#c7c8b6] mt-1 font-light">{tier.description}</p>
                </div>

                <div className="my-6 pb-6 border-b border-white/10">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-[#c7c8b6] font-mono">Min. Deposit:</span>
                    <span className="font-heading text-4xl font-light text-white">
                      ${tier.minDeposit}
                    </span>
                  </div>
                  {tier.bonusPercent > 0 && (
                    <div className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-[#d8ec8d]/15 text-[#d8ec8d] text-xs font-mono font-semibold">
                      +{tier.bonusPercent}% Extra Wallet Credit
                    </div>
                  )}
                </div>

                <ul className="flex flex-col gap-3 mb-8">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-[#e5e2e1]">
                      <Check className="w-4 h-4 text-[#d8ec8d] flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/register"
                className={`w-full py-3 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  tier.recommended
                    ? "bg-[#d8ec8d] text-[#171e00] hover:shadow-[0_0_24px_rgba(216,236,141,0.5)]"
                    : "bg-[#201f1f] text-white hover:bg-white hover:text-black"
                }`}
              >
                <span>Deposit & Get Started</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>

        {/* Note */}
        <div className="text-center text-xs text-[#c7c8b6] font-mono">
          {landingContent.pricingTiers.note}
        </div>
      </div>
    </section>
  );
}
