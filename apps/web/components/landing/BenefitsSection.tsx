"use client";

import React from "react";
import { landingContent } from "@/content/landing";
import { Zap, ShieldCheck, Cpu, CheckCircle2 } from "lucide-react";
import { TiltCard } from "@/components/motion/TiltCard";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";

export function BenefitsSection() {
  const iconMap: Record<string, React.ReactNode> = {
    zap: <Zap className="w-6 h-6 text-blue-400" />,
    "shield-check": <ShieldCheck className="w-6 h-6 text-blue-400" />,
    sparkles: <Cpu className="w-6 h-6 text-blue-400" />,
  };

  return (
    <section id="benefits" data-crown="dim" className="w-full py-24 bg-transparent relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealOnScroll className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 uppercase tracking-widest mb-4 backdrop-blur-md">
            {landingContent.benefits.badge}
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight mb-4">
            {landingContent.benefits.title}
          </h2>
          <p className="text-base text-slate-400 font-light">
            {landingContent.benefits.description}
          </p>
        </RevealOnScroll>

        {/* 3 Pillars Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {landingContent.benefits.items.map((pillar, idx) => (
            <RevealOnScroll key={pillar.id} delay={idx * 0.1}>
              <TiltCard
                maxTilt={4}
                glowColor="rgba(37, 99, 235, 0.2)"
                className="h-full rounded-2xl p-8 bg-gradient-to-b from-white/[0.06] to-white/[0.02] bg-[#070B16]/80 border border-white/[0.08] hover:border-blue-500/40 backdrop-blur-xl flex flex-col justify-between shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-all duration-300 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center group-hover:scale-105 transition-transform backdrop-blur-md">
                      {iconMap[pillar.icon] || <Zap className="w-6 h-6 text-blue-400" />}
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-md font-mono text-blue-400 font-medium">
                      {pillar.badge}
                    </span>
                  </div>

                  <div className="mb-2">
                    <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
                      {pillar.title}
                    </span>
                    <h3 className="font-heading text-2xl font-light text-white mt-1">
                      {pillar.subtitle}
                    </h3>
                  </div>

                  <p className="text-sm text-slate-300 font-light leading-relaxed mb-8">
                    {pillar.description}
                  </p>
                </div>

                <div className="pt-6 border-t border-white/[0.08] flex flex-col gap-2.5">
                  {pillar.metrics.map((m, mIdx) => (
                    <div key={mIdx} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1.5 font-light">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                        {m.label}
                      </span>
                      <span className="font-mono text-white font-medium">{m.value}</span>
                    </div>
                  ))}
                </div>
              </TiltCard>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
