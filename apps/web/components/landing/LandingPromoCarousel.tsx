"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Flame, Sparkles, Zap, ShieldCheck } from "lucide-react";

interface PromoSlide {
  id: string;
  badge: string;
  badgeIcon: React.ReactNode;
  badgeColor: string;
  title: string;
  highlight: string;
  description: string;
  priceLabel: string;
  priceValue: string;
  ctaText: string;
  ctaLink: string;
  gradientBg: string;
  accentBorder: string;
  accentGlow: string;
  illustration: React.ReactNode;
}

export function LandingPromoCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const slides: PromoSlide[] = [
    {
      id: "reel-views-35",
      badge: "MOST ORDERED",
      badgeIcon: <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />,
      badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
      title: "10K Instagram Reel Views",
      highlight: "at Just ₹35!",
      description:
        "Give your reels the visibility and algorithmic velocity they deserve. Get 10,000 real-dispatch views with instant start and high retention.",
      priceLabel: "Total Price",
      priceValue: "₹35",
      ctaText: "Get 10K Views",
      ctaLink: "/new-order?tab=single&platform=instagram",
      gradientBg: "from-[#11160a] via-[#151c0a] to-[#0a0f05] dark:from-[#11160a] dark:via-[#151c0a] dark:to-[#0a0f05]",
      accentBorder: "border-[#D8EC8D]/30",
      accentGlow: "rgba(216, 236, 141, 0.2)",
      illustration: (
        <div className="relative w-44 h-44 sm:w-56 sm:h-56 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#D8EC8D]/30 to-lime-400/10 blur-2xl animate-pulse" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center p-5 sm:p-6 rounded-3xl bg-black/60 dark:bg-black/70 border border-[#D8EC8D]/30 backdrop-blur-xl shadow-2xl shadow-lime-950/40">
            <span className="text-4xl sm:text-5xl mb-2">🚀</span>
            <div className="text-xs uppercase font-bold tracking-widest text-[#D8EC8D]">10,000 Views</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">₹35<span className="text-xs font-normal text-slate-300"> / one-time</span></div>
            <div className="inline-flex items-center gap-1 text-[10px] text-emerald-400 mt-2 font-medium">
              <Zap className="w-3 h-3" /> Starts in 60s
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "engagement-bundle",
      badge: "ALL-IN-ONE BOOST",
      badgeIcon: <Sparkles className="w-3.5 h-3.5 text-lime-500 dark:text-lime-400" />,
      badgeColor: "bg-lime-500/10 text-lime-700 dark:text-[#D8EC8D] border-[#D8EC8D]/30",
      title: "Instagram Engagement",
      highlight: "Power Combo",
      description:
        "Views, Likes, Comments & Shares bundled into a single organic-paced campaign. Engineered for Instagram Explore and Reels discovery.",
      priceLabel: "Starting from",
      priceValue: "₹199",
      ctaText: "Order Combo Pack",
      ctaLink: "/new-order?tab=combos&platform=instagram",
      gradientBg: "from-[#181226] via-[#201538] to-[#0e091b] dark:from-[#161224] dark:via-[#1b142f] dark:to-[#0c0817]",
      accentBorder: "border-purple-500/30",
      accentGlow: "rgba(168, 85, 247, 0.2)",
      illustration: (
        <div className="relative w-44 h-44 sm:w-56 sm:h-56 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-500/25 to-pink-500/10 blur-2xl animate-pulse" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center p-5 sm:p-6 rounded-3xl bg-black/60 dark:bg-black/70 border border-purple-500/30 backdrop-blur-xl shadow-2xl shadow-purple-950/40">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">❤️</span>
              <span className="text-2xl">💬</span>
              <span className="text-2xl">🔁</span>
            </div>
            <div className="text-xs uppercase font-bold tracking-widest text-purple-300">Full Velocity</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">₹199<span className="text-xs font-normal text-slate-300"> onwards</span></div>
            <div className="inline-flex items-center gap-1 text-[10px] text-purple-400 mt-2 font-medium">
              <ShieldCheck className="w-3 h-3" /> 100% Non-Drop Refill
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "reel-boost-discount",
      badge: "ALGORITHM VELOCITY",
      badgeIcon: <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />,
      badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
      title: "Scheduled Reel Drip",
      highlight: "Save up to 15% Today",
      description:
        "Consistent multi-wave delivery over 24-72 hours. Perfect for creators, podcasters, and brand campaigns desiring natural velocity without spikes.",
      priceLabel: "Discount Applied",
      priceValue: "15% OFF",
      ctaText: "Explore Drip Bundles",
      ctaLink: "/new-order?tab=combos",
      gradientBg: "from-[#1d1408] via-[#2a1b05] to-[#0e0903] dark:from-[#1a1208] dark:via-[#241705] dark:to-[#0d0903]",
      accentBorder: "border-amber-500/30",
      accentGlow: "rgba(245, 158, 11, 0.2)",
      illustration: (
        <div className="relative w-44 h-44 sm:w-56 sm:h-56 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500/25 to-yellow-500/10 blur-2xl animate-pulse" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center p-5 sm:p-6 rounded-3xl bg-black/60 dark:bg-black/70 border border-amber-500/30 backdrop-blur-xl shadow-2xl shadow-amber-950/40">
            <span className="text-4xl sm:text-5xl mb-2">🏷️</span>
            <div className="text-xs uppercase font-bold tracking-widest text-amber-300">Promo Discount</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">15% OFF</div>
            <div className="inline-flex items-center gap-1 text-[10px] text-amber-400 mt-2 font-medium">
              ⚡ Multi-Wave Scheduling
            </div>
          </div>
        </div>
      ),
    },
  ];

  // Auto-play timer
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [isPaused, slides.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <section className="w-full pt-4 pb-8 sm:pb-12 bg-transparent relative overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Promotional Banner Carousel Container */}
        <div
          className="relative rounded-3xl overflow-hidden border border-border shadow-2xl backdrop-blur-xl"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const diff = touchStartX.current - e.changedTouches[0].clientX;
            if (diff > 50) nextSlide();
            else if (diff < -50) prevSlide();
            touchStartX.current = null;
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={slides[currentSlide].id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className={`w-full p-6 sm:p-9 lg:p-11 bg-gradient-to-br ${slides[currentSlide].gradientBg} relative text-white`}
            >
              {/* Subtle background glow */}
              <div
                className="absolute -right-20 -top-20 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-40"
                style={{ backgroundColor: slides[currentSlide].accentGlow }}
              />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
                {/* Left 8 Cols: Banner Content */}
                <div className="lg:col-span-7 flex flex-col items-start text-left">
                  {/* Badge */}
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border mb-3 sm:mb-4 ${slides[currentSlide].badgeColor}`}
                  >
                    {slides[currentSlide].badgeIcon}
                    <span>{slides[currentSlide].badge}</span>
                  </div>

                  {/* Headline */}
                  <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15] mb-3">
                    {slides[currentSlide].title}{" "}
                    <span className="text-[#D8EC8D] underline decoration-[#D8EC8D]/50 decoration-wavy decoration-1 underline-offset-4">
                      {slides[currentSlide].highlight}
                    </span>
                  </h2>

                  {/* Description */}
                  <p className="text-sm sm:text-base text-slate-200/90 font-normal leading-relaxed max-w-xl mb-6">
                    {slides[currentSlide].description}
                  </p>

                  {/* Actions & Price */}
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-1">
                    <Link
                      href={slides[currentSlide].ctaLink}
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#D8EC8D] hover:bg-[#cbe27a] text-[#171e00] font-bold text-sm sm:text-base transition-all shadow-[0_0_25px_rgba(216,236,141,0.35)] hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <span>{slides[currentSlide].ctaText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    <div className="flex flex-col">
                      <span className="text-[11px] uppercase tracking-wider text-slate-300/80 font-medium">
                        {slides[currentSlide].priceLabel}
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-white">
                        {slides[currentSlide].priceValue}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right 5 Cols: Visual Illustration */}
                <div className="lg:col-span-5 flex items-center justify-center lg:justify-end">
                  {slides[currentSlide].illustration}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Arrows */}
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/80 border border-white/20 text-white transition-all backdrop-blur-md hidden sm:flex items-center justify-center hover:scale-110 active:scale-95 z-20"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={nextSlide}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/80 border border-white/20 text-white transition-all backdrop-blur-md hidden sm:flex items-center justify-center hover:scale-110 active:scale-95 z-20"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Carousel Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
            {slides.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`transition-all rounded-full ${
                  idx === currentSlide
                    ? "w-8 h-2 bg-[#D8EC8D] shadow-[0_0_10px_rgba(216,236,141,0.5)]"
                    : "w-2 h-2 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
