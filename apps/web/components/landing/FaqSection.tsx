"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { landingContent } from "@/content/landing";
import { Plus } from "lucide-react";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: landingContent.faq.items.map((item) => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer,
      },
    })),
  };

  return (
    <section id="faq" className="w-full py-14 sm:py-20 lg:py-28 bg-transparent relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="max-w-[800px] mx-auto px-4 sm:px-6">
        {/* Left-aligned Title Block (max 2 lines, max-width 560px) */}
        <RevealOnScroll className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-[#D8EC8D] uppercase tracking-wider mb-3">
            {landingContent.faq.badge}
          </div>
          <h2 className="font-heading font-semibold text-[clamp(30px,3.6vw,44px)] leading-tight text-white mb-3">
            {landingContent.faq.title}
          </h2>
          <p className="text-base text-[#A1A1AA] leading-relaxed max-w-[560px]">
            {landingContent.faq.description}
          </p>
        </RevealOnScroll>

        {/* Accordion */}
        <div className="flex flex-col gap-3">
          {landingContent.faq.items.map((item, idx) => {
            const isOpen = openIdx === idx;
            const answerId = `faq-answer-${idx}`;
            return (
              <RevealOnScroll key={idx} delay={idx * 0.04}>
                <div className="rounded-[20px] bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.18] transition-colors overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggle(idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8EC8D] focus-visible:ring-inset"
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                  >
                    <span className="text-base font-semibold text-white leading-snug">
                      {item.question}
                    </span>
                    <motion.div
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="p-1 rounded-full bg-white/[0.05] text-[#D8EC8D] shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={answerId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 pt-0 text-sm sm:text-base text-[#A1A1AA] leading-relaxed border-t border-white/[0.06] mt-2">
                          {item.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </RevealOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}
