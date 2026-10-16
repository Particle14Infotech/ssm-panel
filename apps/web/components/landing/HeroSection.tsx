"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { landingContent } from "@/content/landing";
import { ArrowRight, ChevronRight, Activity } from "lucide-react";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { TiltCard } from "@/components/motion/TiltCard";
import { fadeUpVariant } from "@/lib/motion";

export function HeroSection() {
  return (
    <section
      id="hero"
      data-crown="right"
      className="relative w-full pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden"
    >
      {/* Single subtle, static lime/olive radial light behind hero visual */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-[#243100]/25 blur-[140px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Two-Column Hero on Desktop (Text left, Crown 3D stage right); Centred on Mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center mb-16">
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
            {/* Top telemetry tag - Floating Callout with Liquid Glass accent */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass-pill shadow-lg mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-[#d8ec8d] animate-pulse shadow-[0_0_8px_#d8ec8d]" />
              <span className="text-xs uppercase tracking-widest font-mono text-[#d8ec8d] font-semibold">
                {landingContent.hero.badge}
              </span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="font-heading text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-light tracking-tight text-white leading-[1.12] mb-6 max-w-2xl"
            >
              Order social growth services.{" "}
              <span className="bg-gradient-to-r from-white via-[#ffd5e6] to-[#dbef90] bg-clip-text text-transparent font-normal">
                Track every order.
              </span>
            </motion.h1>

            {/* Subtext */}
            <motion.p
              variants={fadeUpVariant}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.2 }}
              className="text-lg sm:text-xl text-zinc-300 font-light max-w-xl leading-relaxed mb-8"
            >
              {landingContent.hero.support}
            </motion.p>

            {/* Action CTAs */}
            <motion.div
              variants={fadeUpVariant}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto relative z-20"
            >
              <MagneticButton>
                <Link
                  href={landingContent.hero.primaryCta.href}
                  className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-[#d8ec8d] to-[#bef264] text-[#171e00] font-bold text-base hover:shadow-[0_0_32px_rgba(216,236,141,0.5)] transition-all flex items-center justify-center gap-2 group shadow-xl"
                >
                  <span>{landingContent.hero.primaryCta.label}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                </Link>
              </MagneticButton>

              <MagneticButton>
                <Link
                  href={landingContent.hero.secondaryCta.href}
                  className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/[0.08] text-white hover:bg-white/[0.14] border border-white/[0.08] font-medium text-base transition-all flex items-center justify-center gap-2 hover:border-white/20 backdrop-blur-md"
                >
                  <span>{landingContent.hero.secondaryCta.label}</span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </Link>
              </MagneticButton>
            </motion.div>
          </div>

          {/* Right Column: Kept free on desktop for the persistent 3D crown stage */}
          <div className="hidden lg:flex lg:col-span-5 h-[420px] pointer-events-none" />
        </div>

        {/* 3D Feature Grid with Pointer-Tracked Tilt Cards with Liquid Glass Accents */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mt-8">
          {/* Card 1: Wallet & Processing */}
          <div className="lg:col-span-6">
            <TiltCard
              maxTilt={4}
              glowColor="rgba(219, 239, 144, 0.25)"
              className="h-full rounded-2xl p-6 md:p-8 liquid-glass flex flex-col justify-between"
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs uppercase tracking-widest font-mono text-zinc-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#dbef90] shadow-[0_0_8px_#dbef90]" />
                    Wallet & Balance
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.08] text-[#dbef90] font-mono border border-white/10 backdrop-blur-md">
                    Double-Entry
                  </span>
                </div>

                <div className="my-4">
                  <div className="font-heading text-3xl sm:text-4xl font-light text-white tracking-tight">
                    Instant Credit Ledger
                  </div>
                </div>

                <p className="text-sm text-zinc-300 font-light leading-relaxed">
                  Funds are credited directly to your balance. Any partial delivery or cancellation automatically returns unspent funds to your wallet.
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-white/[0.08] relative z-10 flex items-center justify-between text-xs text-zinc-300 font-mono">
                <span className="text-[#dbef90]">Transparent Balance</span>
                <Link
                  href="/pricing"
                  className="font-bold text-[#dbef90] hover:text-white flex items-center gap-1 group/btn"
                >
                  <span>Deposit Rules</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </div>
            </TiltCard>
          </div>

          {/* Card 2: Catalog & API Routing */}
          <div className="lg:col-span-6">
            <TiltCard
              maxTilt={4}
              glowColor="rgba(219, 239, 144, 0.25)"
              className="h-full rounded-2xl p-6 md:p-8 liquid-glass flex flex-col justify-between"
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs uppercase tracking-widest font-mono text-zinc-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#dbef90]" />
                    Service Catalog
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.08] text-[#dbef90] font-semibold border border-white/10 backdrop-blur-md">
                    500+ Active Services
                  </span>
                </div>

                <div className="my-4">
                  <div className="font-heading text-3xl sm:text-4xl font-light text-white tracking-tight">
                    Verified Provider APIs
                  </div>
                </div>

                <p className="text-sm text-zinc-300 font-light leading-relaxed">
                  Real-time status updates and order tracking across Instagram, TikTok, YouTube, Telegram, and X with dedicated API endpoints.
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-white/[0.08] relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#dbef90] animate-pulse shadow-[0_0_8px_#dbef90]" />
                  <span className="text-xs font-mono text-zinc-300">Live Status Sync</span>
                </div>
                <Link
                  href="/services"
                  className="text-xs font-bold text-[#dbef90] hover:text-white flex items-center gap-1 group/btn"
                >
                  <span>View Services</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </div>
            </TiltCard>
          </div>
        </div>
      </div>
    </section>
  );
}
