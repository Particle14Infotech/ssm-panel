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

  return (
    <section id="faq" data-crown="dim" className="w-full py-24 bg-transparent relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealOnScroll className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-xs font-mono text-[#D8EC8D] uppercase tracking-widest mb-4 backdrop-blur-md">
            {landingContent.faq.badge}
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight mb-4">
            {landingContent.faq.title}
          </h2>
          <p className="text-base text-zinc-400 font-light">
            {landingContent.faq.description}
          </p>
        </RevealOnScroll>

        {/* Accordion with Smooth Framer Motion Collapse */}
        <div className="flex flex-col gap-4">
          {landingContent.faq.items.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <RevealOnScroll key={idx} delay={idx * 0.05}>
                <div className="rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] bg-[#1c1b1b]/80 border border-white/[0.08] hover:border-[#D8EC8D]/30 backdrop-blur-xl overflow-hidden transition-all duration-300 shadow-[0_16px_36px_rgba(0,0,0,0.45)]">
                  <button
                    type="button"
                    onClick={() => toggle(idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 focus:outline-none"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/[0.08] text-[#DBEF90] font-mono border border-white/10 backdrop-blur-md">
                        {item.category}
                      </span>
                      <span className="text-base font-medium text-white">{item.question}</span>
                    </div>
                    <motion.div
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="p-1 rounded-full bg-white/[0.08] text-[#D8EC8D]"
                    >
                      <Plus className="w-4 h-4" />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 pt-0 text-sm text-slate-400 font-light leading-relaxed border-t border-white/[0.08] mt-2">
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

        {/* Trademark Disclaimer */}
        <div className="mt-12 text-center text-xs text-slate-500 max-w-2xl mx-auto leading-relaxed border-t border-white/[0.08] pt-6 font-light">
          Instagram, YouTube, Telegram, TikTok, Facebook and X are trademarks of their respective owners. This service is not affiliated with or endorsed by them.
        </div>
      </div>
    </section>
  );
}
