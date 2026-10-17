"use client";

import React from "react";
import { landingContent } from "@/content/landing";
import { PaymentIcon } from "@/components/shared/PaymentIcon";
import { Reveal } from "@/components/motion/Reveal";
import { RevealGroup, RevealItem } from "@/components/motion/RevealGroup";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { motion, useReducedMotion } from "framer-motion";

export function PaymentsSection() {
  const { title, description, minDeposit, methods, badge } = landingContent.payments;
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="payments" className="w-full py-14 md:py-[72px] lg:py-28 bg-[#161616]/40 border-y border-white/[0.06] relative">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Title Block */}
        <div className="max-w-[560px] mb-12 text-left">
          <Reveal delay={0.05}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
              <span className="text-[13px] font-medium text-[#d8ec8d]">
                {badge}
              </span>
            </div>
          </Reveal>

          <SplitHeading
            as="h2"
            className="text-[clamp(30px,3.6vw,44px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-3"
          >
            {title}
          </SplitHeading>

          <Reveal delay={0.15}>
            <p className="text-base text-[#A1A1AA] font-normal leading-relaxed">
              {description} Minimum deposit is ₹{minDeposit}.
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

        {/* Uniform Tiles Grid: Stagger in with scale 0.96 -> 1, hover lift 4px */}
        <RevealGroup stagger={0.05} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {methods.map((method) => (
            <RevealItem key={method.id}>
              <motion.div
                whileHover={shouldReduceMotion ? {} : { y: -4 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="h-24 flex items-center justify-start gap-3.5 p-4 rounded-[20px] border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.22] hover:bg-white/[0.05] transition-colors group cursor-default"
              >
                {/* Uniform white/light-gray rounded plate for crisp logo legibility on dark background */}
                <div className="w-12 h-12 rounded-xl bg-white/[0.95] flex items-center justify-center p-2 shadow-sm shrink-0 border border-white/20 group-hover:scale-105 transition-transform">
                  <PaymentIcon method={method.id} size={28} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white leading-tight">
                    {method.name}
                  </span>
                  <span className="text-xs text-[#A1A1AA] leading-normal">
                    Supported
                  </span>
                </div>
              </motion.div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
