"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { landingContent } from "@/content/landing";
import { Plus } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { RevealGroup, RevealItem } from "@/components/motion/RevealGroup";
import { SplitHeading } from "@/components/motion/SplitHeading";

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
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <section id="faq" className="w-full py-14 sm:py-20 lg:py-28 bg-[#131313] relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="max-w-[800px] mx-auto px-4 sm:px-6">
        {/* Left-aligned Title Block (max 2 lines, max-width 560px) */}
        <div className="mb-12">
          <Reveal delay={0.05}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-[#D8EC8D] uppercase tracking-wider mb-3">
              {landingContent.faq.badge}
            </div>
          </Reveal>

          <SplitHeading
            as="h2"
            className="font-semibold text-[clamp(30px,3.6vw,44px)] leading-tight text-white mb-3"
          >
            {landingContent.faq.title}
          </SplitHeading>

          <Reveal delay={0.15}>
            <p className="text-base text-[#A1A1AA] leading-relaxed max-w-[560px]">
              {landingContent.faq.description}
            </p>
          </Reveal>

          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            className="w-24 h-[1px] bg-gradient-to-r from-[#d8ec8d]/50 to-transparent origin-left mt-6"
          />
        </div>

        {/* Accordion with Smooth Height and Staggered Rise */}
        <RevealGroup stagger={0.04} className="flex flex-col gap-3">
          {landingContent.faq.items.map((item, idx) => {
            const isOpen = openIdx === idx;
            const answerId = `faq-answer-${idx}`;
            return (
              <RevealItem key={idx}>
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
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
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
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 pt-0 text-sm sm:text-base text-[#A1A1AA] leading-relaxed border-t border-white/[0.06] mt-2">
                          {item.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
