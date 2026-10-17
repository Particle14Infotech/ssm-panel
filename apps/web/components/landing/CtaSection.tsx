"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CrownSlot } from "@/components/three/CrownSlot";
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
      className="w-full py-20 sm:py-28 lg:py-36 bg-transparent relative overflow-hidden"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="relative rounded-3xl bg-[#1c1b1b]/80 border border-white/[0.12] backdrop-blur-2xl p-8 sm:p-14 lg:p-20 text-center flex flex-col items-center overflow-hidden shadow-2xl">
          {/* Soft lime light pool */}
          <motion.div
            style={{ scale: shouldReduceMotion ? 1 : radialScale }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[360px] bg-[#d8ec8d]/[0.09] blur-[130px] pointer-events-none rounded-full"
            aria-hidden="true"
          />

          {/* Large Crown Stage Centered Above */}
          <div className="relative z-10 mb-8 flex items-center justify-center">
            <CrownSlot
              id="cta"
              className="w-28 h-28 sm:w-36 sm:h-36 lg:w-44 lg:h-44 pointer-events-none"
            />
          </div>

          {/* Headline */}
          <h2 className="text-[clamp(32px,4.5vw,56px)] font-semibold text-white tracking-[-0.025em] leading-[1.08] mb-5 max-w-2xl relative z-10">
            Ready to place your first order?
          </h2>

          <p className="text-base sm:text-lg text-[#A1A1AA] font-normal leading-relaxed max-w-xl mb-10 relative z-10">
            Create an account in 30 seconds, top up your wallet in INR, and track every order live with automatic balance protection.
          </p>

          {/* One Primary Button */}
          <div className="relative z-10">
            <Link
              href="/register"
              className="h-13 min-h-[48px] px-8 rounded-xl bg-[#d8ec8d] text-[#171e00] font-semibold text-base hover:brightness-105 active:scale-95 transition-all inline-flex items-center justify-center gap-2.5 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8ec8d]"
            >
              <span>Create an account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
