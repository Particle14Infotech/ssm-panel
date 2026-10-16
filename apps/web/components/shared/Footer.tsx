import React from "react";
import Link from "next/link";
import { landingContent } from "@/content/landing";
import { ShieldCheck, Zap, ArrowUpRight, Activity } from "lucide-react";

export function Footer() {
  return (
    <footer data-crown="dim" className="w-full bg-transparent border-t border-white/[0.08] text-slate-300 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Compliance Posture Box */}
        <div className="mb-14 rounded-2xl p-6 md:p-8 bg-gradient-to-b from-white/[0.06] to-white/[0.02] bg-[#070B16]/80 border border-white/[0.08] backdrop-blur-xl relative overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-400 backdrop-blur-md">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-heading font-semibold text-lg text-white mb-1">
                  {landingContent.complianceNotice.title}
                </h4>
                <p className="text-sm text-slate-400 max-w-3xl leading-relaxed font-light">
                  {landingContent.complianceNotice.body}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                <span>All Providers Monitored</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Footer Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/[0.08]">
          {/* Brand Col */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <Zap className="w-4 h-4 text-blue-400" />
              </div>
              <span className="font-heading font-bold text-xl tracking-wider text-white">
                {landingContent.brand.name}
              </span>
              <span className="text-blue-400 font-bold text-xl leading-none">*</span>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed max-w-sm font-light">
              {landingContent.footer.description}
            </p>

            <div className="pt-2 flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-slate-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
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
                      className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1 group font-light"
                    >
                      <span>{link.label}</span>
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-light">
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
