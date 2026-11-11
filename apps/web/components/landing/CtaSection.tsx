"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

export function CtaSection() {
  const ctaRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ctaRef,
    offset: ["start end", "end start"],
  });

  const radialScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1.1, 0.9]);

  return (
    <section
      ref={ctaRef}
      id="cta"
      className="w-full py-12 sm:py-16 lg:py-20 bg-transparent relative overflow-hidden"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="relative rounded-3xl bg-surface-glass border border-border backdrop-blur-2xl p-6 sm:p-10 lg:p-14 text-center flex flex-col items-center overflow-hidden shadow-2xl">
          {/* Soft lime light pool */}
          <motion.div
            style={{ scale: shouldReduceMotion ? 1 : radialScale }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-accent/[0.08] blur-[120px] pointer-events-none rounded-full"
            aria-hidden="true"
          />

          {/* Meaningful high-trust badge (replaces redundant empty 3D slot) */}
          <div className="relative z-10 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/10 border border-accent/25 text-accent-text text-xs sm:text-sm font-medium mb-5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Instant Setup · Instant Delivery · 24/7 Support</span>
          </div>

          {/* Headline */}
          <h2 className="text-[clamp(28px,3.8vw,48px)] font-semibold text-fg tracking-[-0.025em] leading-[1.12] mb-4 max-w-2xl relative z-10">
            Ready to place your first order?
          </h2>

          <p className="text-sm sm:text-base text-fg-muted font-normal leading-relaxed max-w-xl mb-8 relative z-10">
            Create an account in 30 seconds, top up your wallet in INR, and track every order live with automatic balance protection.
          </p>

          {/* Primary Button */}
          <div className="relative z-10">
            <Link
              href="/register"
              className="h-12 min-h-[44px] px-7 rounded-xl bg-accent text-on-accent font-semibold text-sm sm:text-base hover:brightness-105 active:scale-95 transition-all inline-flex items-center justify-center gap-2.5 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span>Create an account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Value props / trust indicators */}
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-8 pt-6 border-t border-border/50 text-xs sm:text-sm text-fg-muted font-medium w-full max-w-xl">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0" /> Instant UPI & Cards
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0" /> Live Order Tracking
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0" /> Unused Funds Protected
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
