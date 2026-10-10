"use client";

import React, { useState } from "react";
import { landingContent } from "@/content/landing";
import { ChevronDown } from "lucide-react";

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="w-full py-24 bg-[#131313] relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1c1b1b] border border-white/10 text-xs font-mono text-[#d8ec8d] uppercase tracking-widest mb-4">
            {landingContent.faq.badge}
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight mb-4">
            {landingContent.faq.title}
          </h2>
          <p className="text-base text-[#c7c8b6] font-light">
            {landingContent.faq.description}
          </p>
        </div>

        {/* Accordion */}
        <div className="flex flex-col gap-4">
          {landingContent.faq.items.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-[#1c1b1b]/80 border border-white/10 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#201f1f] text-[#d8ec8d] font-mono">
                      {item.category}
                    </span>
                    <span className="text-base font-medium text-white">{item.question}</span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-[#c7c8b6] transition-transform duration-200 flex-shrink-0 ${
                      isOpen ? "rotate-180 text-white" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-0 text-sm text-[#c7c8b6] font-light leading-relaxed border-t border-white/5 mt-2">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
