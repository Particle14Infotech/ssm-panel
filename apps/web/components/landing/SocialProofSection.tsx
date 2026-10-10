import React from "react";
import { landingContent } from "@/content/landing";
import { CheckCircle2, TrendingUp, Users, ShieldCheck } from "lucide-react";

export function SocialProofSection() {
  return (
    <section className="w-full py-16 bg-[#0e0e0e]/90 border-y border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-widest font-mono text-[#d8ec8d]">
            VERIFIED METRICS
          </p>
          <h2 className="text-xl md:text-2xl font-light text-white mt-1">
            {landingContent.socialProof.headline}
          </h2>
        </div>

        {/* 4 Core Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {landingContent.socialProof.metrics.map((metric, idx) => (
            <div
              key={idx}
              className="bg-[#1c1b1b] p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center hover:border-white/15 transition-all"
            >
              <div className="font-heading text-3xl md:text-4xl font-light text-[#d8ec8d] mb-1">
                {metric.value}
              </div>
              <div className="text-xs text-[#c7c8b6] uppercase tracking-wider font-mono">
                {metric.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {landingContent.socialProof.testimonials.map((item, idx) => (
            <div
              key={idx}
              className="bg-[#1c1b1b]/80 p-8 rounded-3xl border border-white/10 flex flex-col justify-between"
            >
              <p className="text-sm md:text-base text-[#e5e2e1] italic leading-relaxed mb-6">
                &ldquo;{item.quote}&rdquo;
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div>
                  <div className="text-sm font-semibold text-white">{item.author}</div>
                  <div className="text-xs text-[#c7c8b6]">
                    {item.role} • {item.company}
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-[#201f1f] text-xs font-mono text-[#d8ec8d] border border-white/10">
                  {item.metric}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
