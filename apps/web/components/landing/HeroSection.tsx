"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { landingContent } from "@/content/landing";
import { ArrowRight, ChevronRight, CreditCard, Activity, RotateCcw } from "lucide-react";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { fadeUpVariant } from "@/lib/motion";

import Image from "next/image";

const DynamicCrownStage = dynamic(
  () => import("@/components/three/CrownStage").then((mod) => mod.CrownStage),
  {
    ssr: false,
    loading: () => (
      <div
        className="relative w-full aspect-[4/3] sm:aspect-square max-w-[460px] mx-auto pointer-events-none select-none z-0 flex items-center justify-center overflow-hidden"
        data-testid="crown-stage-fallback"
      >
        <div className="absolute inset-4 bg-[#243100]/25 blur-[90px] rounded-full pointer-events-none" />
        <div className="relative w-[240px] sm:w-[320px] h-[240px] sm:h-[320px] pointer-events-none flex items-center justify-center">
          <Image
            src="/brand/crown-royal@2x.webp"
            alt="SMM Panel 3D royal king's crown emblem"
            width={320}
            height={320}
            priority
            className="w-full h-full object-contain mix-blend-screen pointer-events-none select-none"
          />
        </div>
      </div>
    ),
  }
);

export function HeroSection() {
  const iconMap = {
    wallet: <CreditCard className="w-4 h-4 text-[#d8ec8d]" strokeWidth={1.75} />,
    activity: <Activity className="w-4 h-4 text-[#d8ec8d]" strokeWidth={1.75} />,
    refund: <RotateCcw className="w-4 h-4 text-[#d8ec8d]" strokeWidth={1.75} />,
  };

  return (
    <section
      id="hero"
      className="relative w-full pt-28 pb-14 md:pt-36 md:pb-24 overflow-hidden"
    >
      {/* Contained subtle olive ambient radial glow strictly behind the hero visual */}
      <div className="absolute top-1/4 right-1/4 w-[480px] h-[360px] bg-[#243100]/20 blur-[130px] pointer-events-none rounded-full" />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Heading, Subtext, CTAs, 3 Short Facts */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-[#d8ec8d]" />
              <span className="text-[13px] font-medium text-[#d8ec8d]">
                {landingContent.hero.badge}
              </span>
            </motion.div>

            {/* H1 */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="text-[clamp(40px,5.4vw,68px)] font-semibold text-white leading-[1.06] tracking-[-0.02em] mb-6 max-w-2xl"
            >
              Order social growth.{" "}
              <span className="text-[#d8ec8d]">
                {landingContent.hero.accentWord}
              </span>
            </motion.h1>

            {/* Subtext */}
            <motion.p
              variants={fadeUpVariant}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.15 }}
              className="text-base md:text-lg text-[#A1A1AA] font-normal leading-[1.6] max-w-xl mb-8"
            >
              {landingContent.hero.support}
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeUpVariant}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.25 }}
              className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto relative z-20 mb-10"
            >
              <MagneticButton>
                <Link
                  href={landingContent.hero.primaryCta.href}
                  className="w-full sm:w-auto h-12 px-7 rounded-xl bg-[#d8ec8d] text-[#171e00] font-semibold text-sm hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-[#d8ec8d]"
                >
                  <span>{landingContent.hero.primaryCta.label}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </MagneticButton>

              <MagneticButton>
                <Link
                  href={landingContent.hero.secondaryCta.href}
                  className="w-full sm:w-auto h-12 px-7 rounded-xl border border-white/[0.14] text-white font-medium text-sm hover:bg-white/[0.06] hover:border-white/25 transition-all flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <span>{landingContent.hero.secondaryCta.label}</span>
                  <ChevronRight className="w-4 h-4 text-[#A1A1AA]" />
                </Link>
              </MagneticButton>
            </motion.div>

            {/* Row of 3 Short Facts */}
            <motion.div
              variants={fadeUpVariant}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.35 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full pt-6 border-t border-white/[0.08]"
            >
              {landingContent.hero.facts.map((fact, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 text-left p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                >
                  <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                    {iconMap[fact.icon]}
                  </div>
                  <span className="text-[13px] text-[#A1A1AA] leading-snug">
                    {fact.label}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right Column: Contained 3D Crown Stage */}
          <div className="w-full lg:col-span-5 flex items-center justify-center relative pointer-events-none z-0">
            <DynamicCrownStage />
          </div>
        </div>
      </div>
    </section>
  );
}
