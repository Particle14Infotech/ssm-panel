"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { landingContent } from "@/content/landing";
import { GradientHeroCanvas } from "@/components/3d/GradientHeroCanvas";
import { ArrowRight, Sparkles, Activity, ShieldCheck, Zap, ChevronRight } from "lucide-react";

export function HeroSection() {
  const [velocity, setVelocity] = useState(1422625);

  useEffect(() => {
    const interval = setInterval(() => {
      setVelocity((prev) => prev + Math.floor(Math.random() * 8) + 1);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative w-full pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-tr from-[#bd0183]/15 via-[#ffafd5]/10 to-[#d8ec8d]/10 blur-[130px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Top telemetry tag */}
        <div className="flex items-center justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1c1b1b]/90 border border-white/10 backdrop-blur-md shadow-lg">
            <span className="w-2 h-2 rounded-full bg-[#d8ec8d] animate-pulse" />
            <span className="text-xs uppercase tracking-widest font-mono text-[#d8ec8d] font-semibold">
              {landingContent.hero.badge}
            </span>
          </div>
        </div>

        {/* Hero Main Headline & Subtitle */}
        <div className="text-center max-w-4xl mx-auto mb-12">
          <h1 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-light tracking-tight text-white leading-[1.1] mb-6">
            Order social growth services.{" "}
            <span className="font-semibold bg-gradient-to-r from-white via-[#ffd5e6] to-[#d8ec8d] bg-clip-text text-transparent">
              Track every order.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-[#c7c8b6] font-light max-w-2xl mx-auto leading-relaxed mb-8">
            {landingContent.hero.support}
          </p>

          {/* Primary & Secondary Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={landingContent.hero.primaryCta.href}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-[#d8ec8d] via-[#bccf74] to-[#d8ec8d] text-[#171e00] font-bold text-base hover:shadow-[0_0_32px_rgba(216,236,141,0.5)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2 group shadow-xl"
            >
              <span>{landingContent.hero.primaryCta.label}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href={landingContent.hero.secondaryCta.href}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-[#201f1f]/80 text-white hover:bg-[#2a2a2a] border border-white/10 font-medium text-base transition-all flex items-center justify-center gap-2 hover:border-white/20"
            >
              <span>{landingContent.hero.secondaryCta.label}</span>
              <ChevronRight className="w-4 h-4 text-[#c7c8b6]" />
            </Link>
          </div>
        </div>

        {/* 3D Visual Centerpiece + Split Telemetry Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mt-8">
          {/* Card 1: Active Velocity */}
          <div className="lg:col-span-4 rounded-3xl p-6 md:p-8 bg-[#1c1b1b]/80 border border-white/10 backdrop-blur-xl flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-[#d8ec8d]/30 transition-all">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-widest font-mono text-[#c7c8b6] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#d8ec8d]" />
                  Active Velocity
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#2a2a2a] text-[#d8ec8d] font-mono">
                  +18.4% / hr
                </span>
              </div>

              <div className="my-4">
                <div className="font-heading text-4xl sm:text-5xl font-extralight text-white tracking-tight">
                  {velocity.toLocaleString("en-US")}
                  <span className="text-[#d8ec8d] text-2xl font-bold ml-1">*</span>
                </div>
              </div>

              <p className="text-sm text-[#c7c8b6] font-light leading-relaxed">
                Real-time cross-network synthetic impression dispatch across active provider shards.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-white/10 relative z-10">
              <div className="flex items-end justify-between h-10 gap-1.5 px-1">
                {[35, 55, 85, 100, 65, 40, 60, 90, 70, 50, 95, 80, 45, 88].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${h}%` }}
                    className={`w-full rounded-full transition-all duration-500 ${
                      h > 70 ? "bg-[#d8ec8d]" : "bg-white/15"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-[#c7c8b6] font-mono mt-3">
                <span>T-60s</span>
                <span className="text-[#d8ec8d]">Sync Active</span>
                <span>Now</span>
              </div>
            </div>
          </div>

          {/* Center Card: 3D Shader Dynamic Mesh */}
          <div className="lg:col-span-4 rounded-3xl p-4 bg-[#131313]/90 border border-white/10 backdrop-blur-xl flex flex-col justify-between shadow-2xl relative overflow-hidden min-h-[380px]">
            <GradientHeroCanvas />
          </div>

          {/* Card 3: Conversion Resonance & Cluster */}
          <div className="lg:col-span-4 rounded-3xl p-6 md:p-8 bg-gradient-to-br from-[#ffd5e6]/10 via-[#ffafd5]/5 to-[#bd0183]/20 border border-[#bd0183]/30 backdrop-blur-xl flex flex-col justify-between shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-widest font-mono text-white/80 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#ffafd5]" />
                  Resonance Score
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#bd0183]/40 text-[#ffd5e6] font-semibold">
                  Tier 1 Optimal
                </span>
              </div>

              <div className="my-4">
                <div className="font-heading text-4xl sm:text-5xl font-extralight text-white tracking-tight">
                  98.4<span className="text-2xl text-[#ffafd5] font-light">%</span>
                </div>
              </div>

              <p className="text-sm text-white/80 font-light leading-relaxed">
                Automated cluster re-routing guarantees zero velocity degradation across Instagram, TikTok, and YouTube pipelines.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-white/10 relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#d8ec8d] animate-ping" />
                <span className="text-xs font-mono text-white/90">Throughput: 99.98%</span>
              </div>
              <Link
                href="/services"
                className="text-xs font-bold text-[#ffd5e6] hover:text-white flex items-center gap-1 group/btn"
              >
                <span>View Shards</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
