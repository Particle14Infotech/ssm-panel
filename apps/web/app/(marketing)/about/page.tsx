import React from "react";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { Shield, Zap, RefreshCw, Cpu } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — Standards & Operations",
  description: "Learn about the operational standards behind SMM Panel: secure wallet accounting, automated order queues, and real INR wallet balances.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About — Standards & Operations | SMM Panel",
    description: "Learn about the operational standards behind SMM Panel.",
    url: "/about",
  },
};

export default function AboutPage() {
  const PILLARS = [
    {
      icon: Shield,
      title: "Secure Wallet Accounting",
      desc: "Every wallet transaction (deposits, order debits, partial refunds) is recorded atomically with row-level locks. User balances are calculated from immutable transaction entries.",
    },
    {
      icon: Zap,
      title: "Automated BullMQ Workers",
      desc: "Orders placed by customers are queued in Redis via BullMQ and dispatched directly to upstream provider APIs. State changes sync automatically via background polling jobs.",
    },
    {
      icon: RefreshCw,
      title: "Automatic Partial Refunds",
      desc: "If a provider only partially completes an order, the exact remaining amount is calculated and refunded back to your wallet balance in integer paise without requiring a manual ticket.",
    },
    {
      icon: Cpu,
      title: "Clean Reseller API",
      desc: "Developers and agency owners can integrate directly via our REST API using standard endpoints for service catalog retrieval, order creation, order status queries, and balance checks.",
    },
  ];

  return (
    <div className="w-full pt-28 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ label: "About", href: "/about" }]} />

        <div className="mb-12">
          <p className="text-xs uppercase tracking-widest font-mono text-[#D8EC8D] font-semibold">
            PLATFORM ARCHITECTURE
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight mt-2">
            Engineering for <span className="text-[#D8EC8D] font-normal">Real Money Safety</span>
          </h1>
          <p className="text-zinc-300 text-base sm:text-lg mt-4 leading-relaxed font-light">
            SMM Panel is built on the principle of technical transparency. We do not use fake order counters, synthetic testimonials, or arbitrary service delays. The platform operates as a high-throughput router connecting social creators and marketing agencies directly with direct provider endpoints.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex flex-col gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-[#D8EC8D]/10 border border-[#D8EC8D]/20 flex items-center justify-center text-[#D8EC8D]">
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold text-white">{pillar.title}</h2>
                <p className="text-sm text-zinc-400 leading-relaxed font-light">{pillar.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="p-8 rounded-2xl bg-gradient-to-b from-[#D8EC8D]/10 to-transparent border border-[#D8EC8D]/20 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Ready to get started?</h3>
            <p className="text-sm text-zinc-300 mt-1 font-light">
              Create an account in 30 seconds or browse our live catalog rates.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/register"
              className="px-6 py-3 rounded-full bg-gradient-to-r from-[#D8EC8D] to-[#BEF264] text-[#171e00] font-bold text-sm transition-all hover:brightness-105 shadow-md shadow-[#D8EC8D]/20 text-center w-full sm:w-auto"
            >
              Create Account
            </Link>
            <Link
              href="/services"
              className="px-6 py-3 rounded-full bg-white/[0.06] hover:bg-white/10 text-white font-medium text-sm border border-white/10 transition-colors text-center w-full sm:w-auto"
            >
              Browse Catalog
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
