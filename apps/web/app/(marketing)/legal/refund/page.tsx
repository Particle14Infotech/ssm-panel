import React from "react";
import type { Metadata } from "next";

import { landingContent } from "@/content/landing";
import { Breadcrumb } from "@/components/shared/Breadcrumb";

export const metadata: Metadata = {
  title: "Refund Policy & Balance Guarantee",
  description: "Automated partial refunds, cancellation rules, and wallet credit policies.",
  alternates: {
    canonical: "https://smmarchitecture.com/legal/refund",
  },
};

export default function RefundPage() {
  return (
    <div className="w-full pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-10">
        <Breadcrumb items={[{ label: "Refund Policy", href: "/legal/refund" }]} />
        <span className="text-xs font-mono uppercase tracking-widest text-[#d8ec8d]">
          Ledger Policy
        </span>
        <h1 className="font-heading text-4xl font-light text-white mt-2 mb-4">
          Refund Policy
        </h1>
        <p className="text-xs font-mono text-[#c7c8b6]">Last Updated: January 2025</p>
      </div>

      <div className="glass-panel rounded-3xl p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] flex flex-col gap-6 text-sm text-[#c7c8b6] leading-relaxed">
        <div>
          <h2 className="text-base font-semibold text-white mb-2">1. Automated Partial Refunds</h2>
          <p>
            If an order is marked as <strong>Partial</strong> by a provider network, our background worker immediately calculates the exact remainder:
            <br />
            <code className="inline-block mt-2 px-3 py-1 bg-[#201f1f] rounded-lg text-[#d8ec8d] font-mono text-xs">
              Refund Amount = Charge × (Remains / Initial Quantity)
            </code>
            <br />
            The refunded amount is credited back to your internal wallet ledger within seconds of the status update.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white mb-2">2. Cancelled or Failed Orders</h2>
          <p>
            Orders that cannot be submitted or are permanently cancelled by the upstream provider trigger a 100% full refund of the charged amount directly to your account ledger.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white mb-2">3. Refill Warranties</h2>
          <p>
            Services designated with a refill badge (e.g. 30-Day Refill) allow users or admins to trigger automated refill requests if count drops occur during the warranty window.
          </p>
        </div>
      </div>
    </div>
  );
}
