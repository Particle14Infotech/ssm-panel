"use client";

import React, { useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { landingContent } from "@/content/landing";
import { ArrowRight, ChevronRight, CreditCard, Activity, RotateCcw } from "lucide-react";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { SplitHeading } from "@/components/motion/SplitHeading";
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
  const heroRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Scroll parallax: text rises and fades gently, crown stays more anchored
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const textOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);
  const textY = useTransform(scrollYProgress, [0, 0.8], [0, shouldReduceMotion ? 0 : -28]);
  const crownY = useTransform(scrollYProgress, [0, 0.8], [0, shouldReduceMotion ? 0 : 36]);

  const iconMap = {
    wallet: <CreditCard className="w-4 h-4 text-[#d8ec8d]" strokeWidth={1.75} />,
    activity: <Activity className="w-4 h-4 text-[#d8ec8d]" strokeWidth={1.75} />,
    refund: <RotateCcw className="w-4 h-4 text-[#d8ec8d]" strokeWidth={1.75} />,
  };

  return (
    <section
      ref={heroRef}
      id="hero"
      className="relative w-full pt-28 pb-14 md:pt-36 md:pb-24 overflow-hidden bg-[#131313]"
    >
      {/* Very faint hero grid (3-4% opacity) for depth without noise */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:44px_44px] pointer-events-none [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)]"
        aria-hidden="true"
      />

      {/* ONE soft static lime radial behind the crown (low alpha, contained, no beams) */}
      <div
        className="absolute top-1/4 right-[10%] w-[420px] h-[420px] bg-[#d8ec8d]/[0.05] blur-[120px] pointer-events-none rounded-full -z-10"
        aria-hidden="true"
      />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Heading, Subtext, CTAs, 3 Short Facts */}
          <motion.div
            style={{ opacity: textOpacity, y: textY }}
            className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left"
          >
            {/* 1. Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-[#d8ec8d]" />
              <span className="text-[13px] font-medium text-[#d8ec8d]">
                {landingContent.hero.badge}
              </span>
            </motion.div>

            {/* 2. H1: SplitHeading line-by-line mask reveal (text fully in DOM for immediate LCP) */}
            <SplitHeading
              as="h1"
              isLcp
              accent={landingContent.hero.accentWord}
              className="text-[clamp(40px,5.4vw,68px)] font-semibold text-white leading-[1.06] tracking-[-0.02em] mb-6 max-w-2xl"
            >
              Order social growth.
            </SplitHeading>

            {/* 3. Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="text-base md:text-lg text-[#A1A1AA] font-normal leading-[1.6] max-w-xl mb-8"
            >
              {landingContent.hero.support}
            </motion.p>

            {/* 4. CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto relative z-20 mb-10"
            >
              <MagneticButton>
                <Link
                  href={landingContent.hero.primaryCta.href}
                  className="w-full sm:w-auto h-12 px-7 rounded-xl bg-[#d8ec8d] text-[#171e00] font-semibold text-sm hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-[#d8ec8d]"
                >
                  <span>{landingContent.hero.primaryCta.label}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </MagneticButton>

              <MagneticButton>
                <Link
                  href={landingContent.hero.secondaryCta.href}
                  className="w-full sm:w-auto h-12 px-7 rounded-xl border border-white/[0.14] text-white font-medium text-sm hover:bg-white/[0.06] hover:border-white/25 transition-all flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <span>{landingContent.hero.secondaryCta.label}</span>
                  <ChevronRight className="w-4 h-4 text-[#A1A1AA] group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </MagneticButton>
            </motion.div>

            {/* 5. Row of 3 Short Facts (Staggered, icon + 14px text) */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    staggerChildren: 0.08,
                    delayChildren: 0.52,
                  },
                },
              }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full pt-6 border-t border-white/[0.08]"
            >
              {landingContent.hero.facts.map((fact, idx) => (
                <motion.div
                  key={idx}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                    },
                  }}
                  className="flex items-center gap-3 text-left p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.12] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                    {iconMap[fact.icon]}
                  </div>
                  <span className="text-[14px] text-[#A1A1AA] font-normal leading-snug">
                    {fact.label}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right Column: Contained 3D Crown Stage with Parallax */}
          <motion.div
            style={{ y: crownY }}
            className="w-full lg:col-span-5 flex items-center justify-center relative pointer-events-none z-0"
          >
            <DynamicCrownStage />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
