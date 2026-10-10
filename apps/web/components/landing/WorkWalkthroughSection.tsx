import React from "react";
import { landingContent } from "@/content/landing";
import { ArrowRight, CheckCircle, Database, Cpu, RefreshCw, Layers } from "lucide-react";

export function WorkWalkthroughSection() {
  const stepIcons = [
    <Layers key="1" className="w-5 h-5 text-[#d8ec8d]" />,
    <Database key="2" className="w-5 h-5 text-[#ffafd5]" />,
    <Cpu key="3" className="w-5 h-5 text-[#dae2fc]" />,
    <RefreshCw key="4" className="w-5 h-5 text-[#d8ec8d]" />,
  ];

  return (
    <section className="w-full py-24 bg-[#131313] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1c1b1b] border border-white/10 text-xs font-mono text-[#d8ec8d] uppercase tracking-widest mb-4">
            {landingContent.workWalkthrough.badge}
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight mb-4">
            {landingContent.workWalkthrough.title}
          </h2>
          <p className="text-base text-[#c7c8b6] font-light">
            {landingContent.workWalkthrough.description}
          </p>
        </div>

        {/* 4 Steps Linear Pipeline */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {landingContent.workWalkthrough.steps.map((step, idx) => (
            <div
              key={step.step}
              className="rounded-3xl p-6 bg-[#1c1b1b]/80 border border-white/10 relative flex flex-col justify-between hover:border-white/20 transition-all shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-2xl font-bold text-white/40">
                    {step.step}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-[#201f1f] border border-white/10 flex items-center justify-center">
                    {stepIcons[idx]}
                  </div>
                </div>

                <span className="text-xs uppercase tracking-widest font-mono text-[#d8ec8d] font-semibold block mb-1">
                  {step.tag}
                </span>

                <h3 className="font-heading text-lg font-medium text-white mb-2">
                  {step.title}
                </h3>

                <p className="text-xs text-[#c7c8b6] font-light leading-relaxed mb-4">
                  {step.description}
                </p>
              </div>

              <div className="pt-4 border-t border-white/10 text-[11px] text-white/70 font-mono">
                {step.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
