"use client";

import React, { useRef, useState, useEffect } from "react";
import { landingContent } from "@/content/landing";
import { Reveal } from "@/components/motion/Reveal";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { CrownSlot } from "@/components/three/CrownSlot";
import { Wallet, Layers, Send, CheckCircle2 } from "lucide-react";
import { motion, useScroll, useSpring, useReducedMotion } from "framer-motion";

export function WorkWalkthroughSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState(1);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 75%", "end 65%"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 28,
    restDelta: 0.001,
  });

  useEffect(() => {
    return smoothProgress.on("change", (latest) => {
      if (latest < 0.25) setActiveStep(1);
      else if (latest < 0.50) setActiveStep(2);
      else if (latest < 0.75) setActiveStep(3);
      else setActiveStep(4);
    });
  }, [smoothProgress]);

  const stepIcons = [
    <Wallet key="1" className="w-4 h-4" strokeWidth={1.75} />,
    <Layers key="2" className="w-4 h-4" strokeWidth={1.75} />,
    <Send key="3" className="w-4 h-4" strokeWidth={1.75} />,
    <CheckCircle2 key="4" className="w-4 h-4" strokeWidth={1.75} />,
  ];

  // Plain language step details with zero engineering jargon
  const stepDetails = [
    "Pay with UPI, cards or netbanking",
    "See price per 1,000, min/max and start time",
    "Enter your link and quantity",
    "Watch status live; unused amount returns to your wallet",
  ];

  return (
    <section
      ref={sectionRef}
      id="work"
      className="w-full py-14 sm:py-20 lg:py-28 bg-[#181818]/60 border-y border-white/[0.06] relative"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Title Block with reserved CrownSlot on the right (small on mobile 80px, medium on desktop) */}
        <div className="flex items-start justify-between gap-4 mb-10 md:mb-12">
          <div className="max-w-[560px] text-left">
            <Reveal delay={0.05}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
                <span className="text-[13px] font-medium text-[#d8ec8d]">
                  {landingContent.workWalkthrough.badge}
                </span>
              </div>
            </Reveal>

            <SplitHeading
              as="h2"
              className="text-[clamp(28px,3.6vw,44px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-3"
            >
              {landingContent.workWalkthrough.title}
            </SplitHeading>

            <Reveal delay={0.15}>
              <p className="text-base text-[#A1A1AA] font-normal leading-relaxed">
                {landingContent.workWalkthrough.description}
              </p>
            </Reveal>

            {/* Accent divider line */}
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
            id="steps"
            className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 lg:w-36 lg:h-36 xl:translate-x-16 2xl:translate-x-28 shrink-0"
          />
        </div>

        {/* 4 Steps Container:
            - Phone (< md): Vertical timeline with progress line in left gutter outside card content
            - Tablet (md to lg): 2x2 grid
            - Laptop+ (lg+): 4 columns with horizontal progress line
        */}
        <div className="relative">
          {/* Laptop+ Horizontal Progress Line */}
          <div className="hidden lg:block absolute top-[28px] left-[40px] right-[40px] h-[2px] bg-white/[0.08] pointer-events-none -z-0">
            <motion.div
              style={{ scaleX: shouldReduceMotion ? 1 : smoothProgress }}
              className="h-full bg-[#d8ec8d] origin-left"
            />
          </div>

          {/* Phone Vertical Progress Line: in dedicated left gutter outside card content */}
          <div className="md:hidden absolute top-[24px] bottom-[24px] left-[15px] w-[2px] bg-white/[0.08] pointer-events-none -z-0">
            <motion.div
              style={{ scaleY: shouldReduceMotion ? 1 : smoothProgress }}
              className="w-full bg-[#d8ec8d] origin-top"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10 pl-10 pr-16 xl:pr-0 md:pl-0">
            {landingContent.workWalkthrough.steps.map((step, idx) => {
              const stepNumber = idx + 1;
              const isPassed = activeStep >= stepNumber;
              const isCurrent = activeStep === stepNumber;

              return (
                <div key={step.step} className="relative">
                  {/* Step Dot for Phone Vertical Timeline on the left line */}
                  <div
                    className={`md:hidden absolute -left-[31px] top-6 w-3 h-3 rounded-full border-2 transition-colors duration-300 z-10 ${
                      isPassed
                        ? "bg-[#d8ec8d] border-[#d8ec8d] shadow-[0_0_8px_rgba(216,236,141,0.5)]"
                        : "bg-[#181818] border-white/20"
                    }`}
                  />

                  {/* Card content */}
                  <div
                    className={`h-full rounded-[20px] p-6 border transition-all duration-300 flex flex-col justify-between ${
                      isPassed
                        ? "border-[#d8ec8d]/40 bg-white/[0.04] shadow-[0_4px_24px_rgba(216,236,141,0.04)]"
                        : "border-white/[0.08] bg-white/[0.02]"
                    }`}
                  >
                    <div>
                      {/* Step Header with Step Badge and Icon */}
                      <div className="flex items-center justify-between mb-5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono text-xs font-bold transition-all duration-300 ${
                            isPassed
                              ? "bg-[#d8ec8d] text-[#171e00] shadow-[0_0_12px_rgba(216,236,141,0.3)]"
                              : "bg-white/[0.04] border border-white/[0.08] text-[#A1A1AA]"
                          }`}
                        >
                          {step.step}
                        </div>

                        <motion.div
                          animate={isCurrent ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                          transition={{ duration: 0.4 }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            isPassed
                              ? "bg-[#d8ec8d]/10 text-[#d8ec8d]"
                              : "bg-white/[0.03] text-[#A1A1AA]/60"
                          }`}
                        >
                          {stepIcons[idx]}
                        </motion.div>
                      </div>

                      <h3 className="text-[18px] font-semibold text-white mb-2 leading-snug w-fit">
                        {step.title}
                      </h3>

                      <p className="text-sm text-[#A1A1AA] font-normal leading-relaxed mb-3">
                        {step.description}
                      </p>

                      <p className="text-sm text-white/70 font-normal leading-normal pt-2.5 border-t border-white/[0.06]">
                        {stepDetails[idx]}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
