import React from "react";
import type { Metadata } from "next";
import { landingContent } from "@/content/landing";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { Reveal } from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "Refund Policy & Balance Guarantee",
  description: "Automated partial refunds, cancellation rules, and wallet credit policies.",
  alternates: {
    canonical: "/legal/refund",
  },
};

export default function RefundPage() {
  return (
    <div className="w-full pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <Reveal y={0} delay={0.05}>
        <div className="mb-10">
          <Breadcrumb items={[{ label: "Refund Policy", href: "/legal/refund" }]} />
          <span className="text-xs font-mono uppercase tracking-widest text-[#D8EC8D]">
            Wallet Policy
          </span>
          <h1 className="font-heading text-4xl font-semibold text-white mt-2 mb-4">
            Refund Policy
          </h1>
          <p className="text-xs font-mono text-[#A1A1AA]">Last Updated: January 2025</p>
        </div>

        <div className="rounded-[20px] bg-white/[0.03] border border-white/[0.08] p-8 flex flex-col gap-6 text-sm text-[#A1A1AA] leading-relaxed">
          <div>
            <h2 className="text-base font-semibold text-white mb-2">1. Automated Partial Refunds</h2>
            <p>
              If an order is marked as <strong>Partial</strong> by an upstream provider, our fulfillment worker immediately calculates the exact remainder:
              <br />
              <code className="inline-block mt-2 px-3 py-1 bg-[#131313] border border-white/10 rounded-lg text-[#D8EC8D] font-mono text-xs">
                Refund Amount = Charge × (Remains / Initial Quantity)
              </code>
              <br />
              The refunded amount is credited directly back to your wallet balance within seconds of the status update.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2">2. Cancelled or Failed Orders</h2>
            <p>
              Orders that cannot be submitted or are permanently cancelled by the upstream provider trigger an automatic 100% full refund of the charged amount directly to your account wallet.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2">3. Refill Warranties</h2>
            <p>
              Services designated with a refill badge (e.g. 30-Day Refill) allow users to trigger automated refill requests if count drops occur during the warranty window.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
