"use client";

import React from "react";
import { landingContent } from "@/content/landing";
import { RotateCcw, Activity, LifeBuoy } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { RevealGroup, RevealItem } from "@/components/motion/RevealGroup";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { SpotlightCard } from "@/components/motion/SpotlightCard";
import { motion } from "framer-motion";

export function BenefitsSection() {
  const iconMap: Record<string, React.ReactNode> = {
    refund: <RotateCcw className="w-5 h-5 text-[#d8ec8d]" strokeWidth={1.75} />,
    activity: <Activity className="w-5 h-5 text-[#d8ec8d]" strokeWidth={1.75} />,
    support: <LifeBuoy className="w-5 h-5 text-[#d8ec8d]" strokeWidth={1.75} />,
  };

  return (
    <section id="why" className="w-full py-14 md:py-[72px] lg:py-28 bg-[#131313] relative">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Title Block */}
        <div className="max-w-[560px] mb-12 text-left">
          <Reveal delay={0.05}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
              <span className="text-[13px] font-medium text-[#d8ec8d]">
                {landingContent.benefits.badge}
              </span>
            </div>
          </Reveal>

          <SplitHeading
            as="h2"
            className="text-[clamp(30px,3.6vw,44px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-3"
          >
            {landingContent.benefits.title}
          </SplitHeading>

          <Reveal delay={0.15}>
            <p className="text-base text-[#A1A1AA] font-normal leading-relaxed">
              {landingContent.benefits.description}
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

        {/* 3 Plain Language Cards with SpotlightCard Cursor Highlight */}
        <RevealGroup stagger={0.08} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {landingContent.benefits.items.map((item) => (
            <RevealItem key={item.id} className="h-full">
              <SpotlightCard className="h-full p-6 md:p-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                      {iconMap[item.icon] || <Activity className="w-5 h-5 text-[#d8ec8d]" strokeWidth={1.75} />}
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.04] text-[#d8ec8d] font-medium border border-white/[0.06]">
                      {item.badge}
                    </span>
                  </div>

                  <h3 className="text-[20px] font-semibold text-white mb-2 leading-snug">
                    {item.title}
                  </h3>

                  <p className="text-sm text-[#A1A1AA] font-normal leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </SpotlightCard>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
