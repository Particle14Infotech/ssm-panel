"use client";

import React from "react";
import { landingContent } from "@/content/landing";
import { PaymentIcon } from "@/components/shared/PaymentIcon";
import { Reveal } from "@/components/motion/Reveal";
import { RevealGroup, RevealItem } from "@/components/motion/RevealGroup";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { CrownSlot } from "@/components/three/CrownSlot";
import { motion, useReducedMotion } from "framer-motion";

export function PaymentsSection() {
  const { title, description, minDeposit, methods, badge } = landingContent.payments;
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="payments"
      className="w-full py-14 sm:py-20 lg:py-28 bg-[#161616]/60 border-y border-white/[0.06] relative"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Title Block with reserved CrownSlot (small on mobile 80px, medium on desktop) */}
        <div className="flex items-start justify-between gap-4 mb-10 md:mb-12">
          <div className="max-w-[560px] text-left">
            <Reveal delay={0.05}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
                <span className="text-[13px] font-medium text-[#d8ec8d]">
                  {badge}
                </span>
              </div>
            </Reveal>

            <SplitHeading
              as="h2"
              className="text-[clamp(28px,3.6vw,44px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-3"
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

          {/* Reserved docking slot beside heading / side gutter: never inside text column */}
          <CrownSlot
            id="payments"
            className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 lg:w-36 lg:h-36 xl:translate-x-16 2xl:translate-x-28 shrink-0"
          />
        </div>

        {/* Uniform Tiles Grid: 4 columns desktop, 3 on tablet, 2 on phone */}
        <RevealGroup
          stagger={0.04}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pr-16 xl:pr-0"
        >
          {methods.map((method) => (
            <RevealItem key={method.id}>
              <motion.div
                whileHover={shouldReduceMotion ? {} : { y: -3 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="h-20 sm:h-22 flex items-center justify-start gap-3.5 p-3.5 sm:p-4 rounded-[20px] border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.22] hover:bg-white/[0.05] transition-colors group cursor-default"
              >
                {/* Uniform white/light plate with padding, logo object-fit: contain >= 28px high */}
                <div className="w-14 h-11 rounded-xl bg-white/[0.96] flex items-center justify-center p-2 shadow-sm shrink-0 border border-white/20 group-hover:scale-105 transition-transform">
                  <PaymentIcon method={method.id} size={28} />
                </div>
                {/* Brand name only (no repeated Supported label) */}
                <span className="text-sm font-medium text-white leading-tight truncate">
                  {method.name}
                </span>
              </motion.div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
