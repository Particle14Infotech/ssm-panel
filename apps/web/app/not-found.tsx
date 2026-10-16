import React from "react";
import Link from "next/link";
import { Home, Layers, DollarSign, HelpCircle, Mail } from "lucide-react";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#02040A] text-slate-300 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 flex flex-col items-center text-center justify-center">
        <Breadcrumb items={[{ label: "404 Not Found" }]} />

        {/* 404 Visual Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 uppercase tracking-widest mb-6 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          HTTP 404 • Resource Not Found
        </div>

        {/* Single H1 Tag */}
        <h1 className="font-heading text-4xl sm:text-6xl font-light text-white tracking-tight mb-4">
          Lost in the <span className="text-[#3B82F6] font-normal">Network</span>?
        </h1>

        <p className="text-slate-400 text-lg max-w-lg mb-10 leading-relaxed font-light">
          The endpoint or page you requested could not be located on the authoritative routing cluster.
          Verify the URL slug or explore our core platforms below.
        </p>

        {/* Primary Action Button */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-14">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 text-white font-medium text-sm hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/25"
          >
            <Home className="w-4 h-4" />
            <span>Return to Homepage</span>
          </Link>

          <Link
            href="/services"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/[0.06] border border-white/[0.08] text-white hover:bg-white/[0.12] text-sm font-medium transition-all"
          >
            <Layers className="w-4 h-4 text-blue-400" />
            <span>Browse Services Catalog</span>
          </Link>
        </div>

        {/* Quick Directory Cards */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <Link
            href="/pricing"
            className="p-5 rounded-2xl bg-[#070B16] border border-white/[0.08] hover:border-blue-500/40 transition-all group"
          >
            <DollarSign className="w-5 h-5 text-blue-400 mb-3 group-hover:scale-105 transition-transform" />
            <h2 className="text-white font-medium text-sm mb-1">Pricing & Bonus Rates</h2>
            <p className="text-slate-400 text-xs font-light">View tiered discounts and automatic deposit top-ups.</p>
          </Link>

          <Link
            href="/faq"
            className="p-5 rounded-2xl bg-[#070B16] border border-white/[0.08] hover:border-blue-500/40 transition-all group"
          >
            <HelpCircle className="w-5 h-5 text-blue-400 mb-3 group-hover:scale-105 transition-transform" />
            <h2 className="text-white font-medium text-sm mb-1">Knowledge Base</h2>
            <p className="text-slate-400 text-xs font-light">Frequently asked questions and API integration guides.</p>
          </Link>

          <Link
            href="/contact"
            className="p-5 rounded-2xl bg-[#070B16] border border-white/[0.08] hover:border-blue-500/40 transition-all group"
          >
            <Mail className="w-5 h-5 text-blue-400 mb-3 group-hover:scale-105 transition-transform" />
            <h2 className="text-white font-medium text-sm mb-1">Contact Support</h2>
            <p className="text-slate-400 text-xs font-light">Direct assistance for volume orders and reseller keys.</p>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
