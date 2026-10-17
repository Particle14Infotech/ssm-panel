"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { motion, useScroll, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { CrownSlot } from "@/components/three/CrownSlot";

const STEPS = [
  {
    num: "01",
    total: "04",
    title: "Add funds",
    sentence: "Top up your wallet in INR using UPI, cards, or netbanking with instant credit.",
    previewSrc: "/previews/preview-add-funds.png",
    alt: "Add funds preview",
  },
  {
    num: "02",
    total: "04",
    title: "Choose a service",
    sentence: "Select your platform and service with transparent rates per 1,000 shown upfront.",
    previewSrc: "/previews/preview-choose-service.png",
    alt: "Choose service preview",
  },
  {
    num: "03",
    total: "04",
    title: "Place your order",
    sentence: "Enter your destination link, adjust your desired quantity, and confirm in one click.",
    previewSrc: "/previews/preview-place-order.png",
    alt: "Place order preview",
  },
  {
    num: "04",
    total: "04",
    title: "Track and get refunds",
    sentence: "Follow order progress live; unfulfilled amounts automatically return to your wallet.",
    previewSrc: "/previews/preview-track-order.png",
    alt: "Track order preview",
  },
];

export function WorkWalkthroughSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 240,
    damping: 30,
    restDelta: 0.001,
  });

  useEffect(() => {
    return smoothProgress.on("change", (latest) => {
      const idx = Math.min(3, Math.max(0, Math.floor(latest * 4)));
      setActiveStep(idx);
    });
  }, [smoothProgress]);

  const step = STEPS[activeStep];

  return (
    <section
      ref={containerRef}
      id="work"
      className="relative w-full h-[280vh] bg-transparent"
    >
      {/* Pinned Sticky Stage */}
      <div className="sticky top-0 h-screen w-full flex flex-col justify-center items-center overflow-hidden px-4 sm:px-6">
        <div className="max-w-[1200px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Mobile view: Preview top, text below */}
          {/* Desktop view: Left column = text + progress rail (7 cols), Right column = glass preview + crown stage (5 cols) */}

          {/* Left Column (Text & Step Info) */}
          <div className="order-2 lg:order-1 lg:col-span-6 flex flex-col justify-center text-left">
            {/* Eyebrow & Step Counter */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs uppercase tracking-widest text-[#d8ec8d] font-mono px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08]">
                How It Works
              </span>
              <span className="text-xs font-mono text-[#A1A1AA]">
                {step.num} / {step.total}
              </span>
            </div>

            {/* Step Title & Sentence with crisp crossfade transition */}
            <div className="min-h-[140px] sm:min-h-[160px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <h2 className="text-[clamp(28px,3.8vw,48px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-4">
                    {step.title}
                  </h2>
                  <p className="text-base sm:text-lg text-[#A1A1AA] font-normal leading-relaxed max-w-lg">
                    {step.sentence}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Progress Rail with 4 Dots */}
            <div className="flex items-center gap-3 mt-8">
              {STEPS.map((s, i) => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    if (containerRef.current) {
                      const top = containerRef.current.offsetTop;
                      const height = containerRef.current.offsetHeight;
                      window.scrollTo({
                        top: top + (i / 4) * height + 10,
                        behavior: "smooth",
                      });
                    }
                  }}
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-2 group focus:outline-none`}
                  aria-label={`Go to step ${s.num}`}
                >
                  <span
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === activeStep
                        ? "w-8 bg-[#d8ec8d] shadow-[0_0_10px_rgba(216,236,141,0.5)]"
                        : i < activeStep
                        ? "w-2 bg-[#d8ec8d]/50"
                        : "w-2 bg-white/20 group-hover:bg-white/40"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Right Column (Glass Preview Panel + Crown Stage) */}
          <div className="order-1 lg:order-2 lg:col-span-6 flex flex-col items-center justify-center relative">
            {/* Glass Preview Panel */}
            <div className="w-full max-w-[540px] rounded-2xl bg-[#1c1b1b]/80 border border-white/[0.12] backdrop-blur-2xl p-3 sm:p-4 shadow-2xl relative overflow-hidden">
              {/* Window Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                </div>
                <div className="text-[11px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-white/70">
                  Preview
                </div>
              </div>

              {/* Screen Preview Image */}
              <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#131313] border border-white/[0.06]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step.num}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={step.previewSrc}
                      alt={step.alt}
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 768px) 100vw, 540px"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Reserved 3D Crown Slot for Story stage */}
            <CrownSlot
              id="steps"
              className="absolute -top-12 -right-8 lg:-right-12 w-28 h-28 pointer-events-none z-10"
            />
          </div>

        </div>
      </div>
    </section>
  );
}
