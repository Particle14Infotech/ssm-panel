import React from "react";
import Link from "next/link";
import { landingContent } from "@/content/landing";
import { ShieldCheck, Zap, ArrowUpRight, Activity } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full bg-[#0e0e0e] border-t border-white/10 text-[#e5e2e1] pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Compliance Posture Box */}
        <div className="mb-14 rounded-3xl p-6 md:p-8 bg-[#1c1b1b]/80 border border-white/10 backdrop-blur-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#201f1f] border border-white/10 flex items-center justify-center flex-shrink-0 text-[#d8ec8d]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-heading font-semibold text-lg text-white mb-1">
                  {landingContent.complianceNotice.title}
                </h4>
                <p className="text-sm text-[#c7c8b6] max-w-3xl leading-relaxed">
                  {landingContent.complianceNotice.body}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="px-3.5 py-1.5 rounded-full bg-[#2a2a2a] border border-white/10 text-xs font-mono text-[#d8ec8d] flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                <span>All Providers Monitored</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Footer Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/10">
          {/* Brand Col */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#bd0183] to-[#d8ec8d] p-[1px] flex items-center justify-center">
                <div className="w-full h-full bg-[#131313] rounded-full flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[#d8ec8d]" />
                </div>
              </div>
              <span className="font-heading font-bold text-xl tracking-wider text-white">
                {landingContent.brand.name}
              </span>
              <span className="text-[#d8ec8d] font-bold text-xl">*</span>
            </div>

            <p className="text-sm text-[#c7c8b6] leading-relaxed max-w-sm">
              {landingContent.footer.description}
            </p>

            <div className="pt-2 flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#1c1b1b] border border-white/10 text-xs text-[#c7c8b6]">
                <span className="w-2 h-2 rounded-full bg-[#d8ec8d] animate-pulse" />
                <span>{landingContent.brand.version}</span>
              </div>
            </div>
          </div>

          {/* Links Columns */}
          {landingContent.footer.columns.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <h5 className="text-xs uppercase tracking-widest font-mono text-white/90 font-semibold">
                {col.title}
              </h5>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#c7c8b6] hover:text-white transition-colors flex items-center gap-1 group"
                    >
                      <span>{link.label}</span>
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#c7c8b6]">
          <div>{landingContent.footer.copyright}</div>
          <div className="flex items-center gap-6">
            <Link href="/legal/terms" className="hover:text-white transition-colors">
              Terms & Conditions
            </Link>
            <Link href="/legal/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/legal/refund" className="hover:text-white transition-colors">
              Refund Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
