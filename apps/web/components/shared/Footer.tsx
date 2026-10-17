"use client";

import React from "react";
import Link from "next/link";
import { landingContent } from "@/content/landing";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { Reveal } from "@/components/motion/Reveal";

export function Footer() {
  return (
    <footer className="w-full bg-[#131313] border-t border-white/[0.08] text-zinc-400 pt-16 pb-12 relative z-10">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <Reveal delay={0.05}>
          {/* Main Footer Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/[0.08]">
            {/* Brand Col: Logo + one sentence */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <BrandLogo variant="combined" size={32} withLink href="/" />
              </div>
              <p className="text-sm text-[#A1A1AA] leading-relaxed max-w-sm">
                {landingContent.footer.description}
              </p>
            </div>

            {/* 3 Link Columns: Product, Support, Legal */}
            {landingContent.footer.columns.map((col) => (
              <div key={col.title} className="flex flex-col gap-3">
                <h3 className="text-xs uppercase tracking-wider font-mono text-white font-semibold">
                  {col.title}
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-[#A1A1AA] hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom Bar: Copyright & Shortened Trademark Disclaimer */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#71717A]">
            <div>{landingContent.footer.copyright}</div>
            <p className="max-w-xl text-center sm:text-right leading-relaxed">
              {landingContent.footer.trademarkDisclaimer}
            </p>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}
