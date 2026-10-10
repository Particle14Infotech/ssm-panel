import React from "react";
import { landingContent } from "@/content/landing";
import { Zap, ShieldCheck, Sparkles, Server, CheckCircle2 } from "lucide-react";

export function BenefitsSection() {
  const iconMap: Record<string, React.ReactNode> = {
    zap: <Zap className="w-6 h-6 text-[#d8ec8d]" />,
    "shield-check": <ShieldCheck className="w-6 h-6 text-[#ffafd5]" />,
    sparkles: <Sparkles className="w-6 h-6 text-[#dae2fc]" />,
  };

  return (
    <section className="w-full py-24 bg-[#131313] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1c1b1b] border border-white/10 text-xs font-mono text-[#d8ec8d] uppercase tracking-widest mb-4">
            {landingContent.benefits.badge}
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight mb-4">
            {landingContent.benefits.title}
          </h2>
          <p className="text-base text-[#c7c8b6] font-light">
            {landingContent.benefits.description}
          </p>
        </div>

        {/* 3 Pillars Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {landingContent.benefits.items.map((pillar) => (
            <div
              key={pillar.id}
              className="rounded-3xl p-8 bg-[#1c1b1b]/90 border border-white/10 backdrop-blur-xl flex flex-col justify-between hover:border-white/25 hover:shadow-2xl transition-all duration-300 group"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#201f1f] border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {iconMap[pillar.icon] || <Zap className="w-6 h-6 text-white" />}
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-[#201f1f] border border-white/10 text-[#d8ec8d] font-mono">
                    {pillar.badge}
                  </span>
                </div>

                <div className="mb-2">
                  <span className="text-xs font-mono uppercase tracking-widest text-[#c7c8b6]">
                    {pillar.title}
                  </span>
                  <h3 className="font-heading text-2xl font-light text-white mt-1">
                    {pillar.subtitle}
                  </h3>
                </div>

                <p className="text-sm text-[#c7c8b6] font-light leading-relaxed mb-8">
                  {pillar.description}
                </p>
              </div>

              <div className="pt-6 border-t border-white/10 flex flex-col gap-2.5">
                {pillar.metrics.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-[#c7c8b6] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#d8ec8d]" />
                      {m.label}
                    </span>
                    <span className="font-mono text-white font-medium">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
