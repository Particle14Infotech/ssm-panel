"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { landingContent } from "@/content/landing";
import { ArrowRight, ChevronRight, CreditCard, Activity, RotateCcw } from "lucide-react";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { SplitHeading } from "@/components/motion/SplitHeading";
import { CrownSlot } from "@/components/three/CrownSlot";

export function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Scroll parallax: text rises gently, crown stays anchored
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const textOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);
  const textY = useTransform(scrollYProgress, [0, 0.8], [0, shouldReduceMotion ? 0 : -28]);

  const iconMap = {
    wallet: <CreditCard className="w-4 h-4 text-[#d8ec8d]" strokeWidth={1.75} />,
    activity: <Activity className="w-4 h-4 text-[#d8ec8d]" strokeWidth={1.75} />,
    refund: <RotateCcw className="w-4 h-4 text-[#d8ec8d]" strokeWidth={1.75} />,
  };

  const renderFactChips = (isMobileView: boolean) => (
    <div
      className={`grid grid-cols-1 sm:grid-cols-3 gap-3 w-full ${
        isMobileView ? "pt-2" : "pt-6 border-t border-white/[0.08]"
      }`}
    >
      {landingContent.hero.facts.map((fact, idx) => (
        <div
          key={idx}
          className="h-12 min-h-[48px] sm:h-auto flex items-center gap-3 text-left p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.12] transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
            {iconMap[fact.icon]}
          </div>
          <span className="text-[14px] text-[#A1A1AA] font-normal leading-snug">
            {fact.label}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <section
      ref={heroRef}
      id="hero"
      className="relative w-full pt-28 pb-14 sm:pt-32 sm:pb-16 md:pt-36 md:pb-24 overflow-hidden bg-[#131313]"
    >
      {/* Very faint background grid (3% opacity) */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:44px_44px] pointer-events-none [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)]"
        aria-hidden="true"
      />

      {/* ONE soft static lime radial behind the crown (low alpha, contained, no beams) */}
      <div
        className="absolute top-1/4 right-[8%] w-[420px] h-[420px] bg-[#d8ec8d]/[0.05] blur-[120px] pointer-events-none rounded-full -z-10"
        aria-hidden="true"
      />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Main Hero Column: Eyebrow, H1, text, CTAs */}
          <motion.div
            style={{ opacity: textOpacity, y: textY }}
            className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left order-1"
          >
            {/* 1. Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6">
              <span className="w-2 h-2 rounded-full bg-[#d8ec8d]" />
              <span className="text-[13px] font-medium text-[#d8ec8d]">
                {landingContent.hero.badge}
              </span>
            </div>

            {/* 2. H1: SplitHeading line-by-line reveal with real text nodes and LCP ready */}
            <SplitHeading
              as="h1"
              isLcp
              accent={landingContent.hero.accentWord}
              className="text-[clamp(36px,5.4vw,68px)] font-semibold text-white leading-[1.06] tracking-[-0.02em] mb-6 max-w-2xl"
            >
              Order social growth.
            </SplitHeading>

            {/* 3. Subtext */}
            <p className="text-base sm:text-lg text-[#A1A1AA] font-normal leading-[1.6] max-w-xl mb-8">
              {landingContent.hero.support}
            </p>

            {/* 4. CTAs: Full width on mobile, inline on tablet+ */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto relative z-20 mb-8 sm:mb-10">
              <div className="w-full sm:w-auto">
                <MagneticButton>
                  <Link
                    href={landingContent.hero.primaryCta.href}
                    className="w-full sm:w-auto h-12 px-7 rounded-xl bg-[#d8ec8d] text-[#171e00] font-semibold text-sm hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-[#d8ec8d]"
                  >
                    <span>{landingContent.hero.primaryCta.label}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </MagneticButton>
              </div>

              <div className="w-full sm:w-auto">
                <MagneticButton>
                  <Link
                    href={landingContent.hero.secondaryCta.href}
                    className="w-full sm:w-auto h-12 px-7 rounded-xl border border-white/[0.14] text-white font-medium text-sm hover:bg-white/[0.06] hover:border-white/25 active:scale-95 transition-all flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <span>{landingContent.hero.secondaryCta.label}</span>
                    <ChevronRight className="w-4 h-4 text-[#A1A1AA] group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </MagneticButton>
              </div>
            </div>

            {/* Desktop Fact Chips: Left Column below CTAs */}
            <div className="hidden lg:block w-full">
              {renderFactChips(false)}
            </div>
          </motion.div>

          {/* EXACTLY ONE CrownSlot for Hero:
              On mobile (< lg): Centered between CTAs and Fact Chips
              On desktop (>= lg): Positioned in right column
          */}
          <div className="order-2 lg:col-span-5 flex items-center justify-center w-full">
            <CrownSlot
              id="hero"
              className="w-[56vw] max-w-[280px] sm:max-w-[340px] lg:max-w-[420px] lg:w-full aspect-square mx-auto pointer-events-none"
            />
          </div>

          {/* Mobile Fact Chips: Rendered after CrownSlot on mobile viewports (< lg) */}
          <div className="order-3 lg:hidden w-full pt-4 border-t border-white/[0.08]">
            {renderFactChips(true)}
          </div>
        </div>
      </div>
    </section>
  );
}
