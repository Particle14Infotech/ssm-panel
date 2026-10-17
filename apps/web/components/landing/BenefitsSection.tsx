"use client";

import React from "react";
import { landingContent } from "@/content/landing";
import { RotateCcw, Activity, LifeBuoy } from "lucide-react";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";

export function BenefitsSection() {
  const iconMap: Record<string, React.ReactNode> = {
    refund: <RotateCcw className="w-5 h-5 text-[#d8ec8d]" strokeWidth={1.75} />,
    activity: <Activity className="w-5 h-5 text-[#d8ec8d]" strokeWidth={1.75} />,
    support: <LifeBuoy className="w-5 h-5 text-[#d8ec8d]" strokeWidth={1.75} />,
  };

  return (
    <section id="why" className="w-full py-14 md:py-[72px] lg:py-28 bg-transparent relative">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Title Block */}
        <RevealOnScroll className="max-w-[560px] mb-12 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
            <span className="text-[13px] font-medium text-[#d8ec8d]">
              {landingContent.benefits.badge}
            </span>
          </div>
          <h2 className="text-[clamp(30px,3.6vw,44px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-3">
            {landingContent.benefits.title}
          </h2>
          <p className="text-base text-[#A1A1AA] font-normal leading-relaxed">
            {landingContent.benefits.description}
          </p>
        </RevealOnScroll>

        {/* 3 Plain Language Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {landingContent.benefits.items.map((item, idx) => (
            <RevealOnScroll key={item.id} delay={idx * 0.08}>
              <div className="h-full rounded-[20px] p-6 md:p-7 border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16] transition-colors flex flex-col justify-between">
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
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
