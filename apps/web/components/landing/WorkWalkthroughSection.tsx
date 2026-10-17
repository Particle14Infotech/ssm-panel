"use client";

import React from "react";
import { landingContent } from "@/content/landing";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";

export function WorkWalkthroughSection() {
  const steps = landingContent.workWalkthrough.steps;

  return (
    <section id="work" className="w-full py-14 md:py-[72px] lg:py-28 bg-transparent relative">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Title Block */}
        <RevealOnScroll className="max-w-[560px] mb-12 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
            <span className="text-[13px] font-medium text-[#d8ec8d]">
              {landingContent.workWalkthrough.badge}
            </span>
          </div>
          <h2 className="text-[clamp(30px,3.6vw,44px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-3">
            {landingContent.workWalkthrough.title}
          </h2>
          <p className="text-base text-[#A1A1AA] font-normal leading-relaxed">
            {landingContent.workWalkthrough.description}
          </p>
        </RevealOnScroll>

        {/* 4 Steps: Horizontal on Desktop, Vertical on Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, idx) => (
            <RevealOnScroll key={step.step} delay={idx * 0.06}>
              <div className="h-full rounded-[20px] p-6 md:p-7 border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16] transition-colors flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center font-mono text-sm font-semibold text-[#d8ec8d] mb-4">
                    {step.step}
                  </div>
                  <h3 className="text-[19px] font-semibold text-white mb-2 leading-snug">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#A1A1AA] font-normal leading-relaxed">
                    {step.description}
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
