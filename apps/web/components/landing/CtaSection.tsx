"use client";

import React from "react";
import Link from "next/link";
import { landingContent } from "@/content/landing";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="w-full py-14 sm:py-20 lg:py-28 bg-transparent relative">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <RevealOnScroll className="rounded-[20px] bg-white/[0.03] border border-white/[0.08] p-8 sm:p-12 lg:p-16 text-center flex flex-col items-center">
          <h2 className="font-heading font-semibold text-[clamp(30px,3.6vw,44px)] leading-tight text-white mb-4 max-w-2xl">
            {landingContent.ctaBand.title}
          </h2>
          <p className="text-base sm:text-lg text-[#A1A1AA] leading-relaxed max-w-xl mb-8">
            {landingContent.ctaBand.description}
          </p>
          <Link
            href={landingContent.ctaBand.buttonHref}
            className="h-12 px-8 rounded-[12px] bg-[#D8EC8D] text-[#131313] font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-[#c9dd7e] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8EC8D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131313]"
          >
            <span>{landingContent.ctaBand.buttonText}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </RevealOnScroll>
      </div>
    </section>
  );
}
