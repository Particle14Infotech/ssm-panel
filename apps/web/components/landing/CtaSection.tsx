"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { landingContent } from "@/content/landing";
import { ArrowRight } from "lucide-react";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { CrownSlot } from "@/components/three/CrownSlot";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

export function CtaSection() {
  const ctaRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ctaRef,
    offset: ["start end", "end start"],
  });

  const radialY = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);

  return (
    <section
      ref={ctaRef}
      className="w-full py-14 sm:py-20 lg:py-28 bg-[#131313] relative overflow-hidden"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-[20px] bg-white/[0.03] border border-white/[0.08] p-8 sm:p-12 lg:p-16 text-center flex flex-col items-center overflow-hidden"
        >
          {/* Subtle static lime radial highlight shifting slightly with scroll */}
          <motion.div
            style={{ y: shouldReduceMotion ? "0%" : radialY }}
            className="absolute -top-[120px] left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#d8ec8d]/[0.07] blur-[100px] pointer-events-none rounded-full"
            aria-hidden="true"
          />

          {/* Reserved docking slot centered above final CTA */}
          <CrownSlot
            id="cta"
            className="w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36 mb-6"
          />

          <h2 className="font-heading font-semibold text-[clamp(28px,3.6vw,44px)] leading-tight text-white mb-4 max-w-2xl relative z-10">
            {landingContent.ctaBand.title}
          </h2>

          <p className="text-base sm:text-lg text-[#A1A1AA] leading-relaxed max-w-xl mb-8 relative z-10">
            {landingContent.ctaBand.description}
          </p>

          <div className="relative z-10">
            <MagneticButton>
              <Link
                href={landingContent.ctaBand.buttonHref}
                className="group h-12 px-8 rounded-[12px] bg-[#D8EC8D] text-[#171e00] font-semibold text-sm inline-flex items-center justify-center gap-2 hover:brightness-105 active:scale-95 transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8EC8D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131313]"
              >
                <span>{landingContent.ctaBand.buttonText}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </MagneticButton>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
