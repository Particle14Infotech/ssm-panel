"use client";

import React from "react";
import { landingContent } from "@/content/landing";
import { PaymentIcon } from "@/components/shared/PaymentIcon";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";

export function PaymentsSection() {
  const { title, description, minDeposit, methods, badge } = landingContent.payments;

  return (
    <section id="payments" className="w-full py-14 md:py-[72px] lg:py-28 bg-transparent relative">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Title Block */}
        <RevealOnScroll className="max-w-[560px] mb-12 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
            <span className="text-[13px] font-medium text-[#d8ec8d]">
              {badge}
            </span>
          </div>
          <h2 className="text-[clamp(30px,3.6vw,44px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-3">
            {title}
          </h2>
          <p className="text-base text-[#A1A1AA] font-normal leading-relaxed">
            {description} Minimum deposit is ₹{minDeposit}.
          </p>
        </RevealOnScroll>

        {/* Uniform Tiles Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {methods.map((method, idx) => (
            <RevealOnScroll key={method.id} delay={idx * 0.04}>
              <div className="h-20 flex items-center justify-center gap-3 p-4 rounded-[20px] border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16] transition-colors">
                <PaymentIcon method={method.id} size={28} />
                <span className="text-sm font-medium text-white/90">
                  {method.name}
                </span>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
