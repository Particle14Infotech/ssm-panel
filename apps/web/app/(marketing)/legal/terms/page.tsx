import React from "react";
import type { Metadata } from "next";
import { landingContent } from "@/content/landing";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { Reveal } from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "Terms of Service & Usage Agreement",
  description: `Terms and conditions governing the use of the ${landingContent.brand.name} platform and provider API services.`,
  alternates: {
    canonical: "/legal/terms",
  },
};

export default function TermsPage() {
  return (
    <div className="w-full pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <Reveal y={0} delay={0.05}>
        <div className="mb-10">
          <Breadcrumb items={[{ label: "Terms of Service", href: "/legal/terms" }]} />
          <span className="text-xs font-mono uppercase tracking-widest text-[#D8EC8D]">
            Legal Documentation
          </span>
          <h1 className="font-heading text-4xl font-semibold text-white mt-2 mb-4">
            Terms of Service
          </h1>
          <p className="text-xs font-mono text-[#A1A1AA]">Last Updated: January 2025</p>
        </div>

        <div className="rounded-[20px] bg-white/[0.03] border border-white/[0.08] p-8 flex flex-col gap-6 text-sm text-[#A1A1AA] leading-relaxed">
          <div>
            <h2 className="text-base font-semibold text-white mb-2">1. Compliance & Authorized Fulfilment</h2>
            <p>
              {landingContent.brand.name} operates strictly through authorized provider APIs where permitted by the platform and service provider. We do not participate in credential harvesting, bot account creation, CAPTCHA bypassing, or platform security circumvention.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2">2. Service Availability & Delivery Rates</h2>
            <p>
              Service availability and processing speeds are determined in real-time by provider networks. While our systems continuously monitor order progress and balance, estimated start times and delivery rates are averages and not fixed guarantees.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2">3. Wallet & Account Balance</h2>
            <p>
              Account balances represent internal service credits. Every debit and refund is processed through protected database transactions with unique idempotency keys to ensure balance integrity.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2">4. Order Cancellation & Refunds</h2>
            <p>
              Orders may be cancelled if provider networks encounter disruptions. In such cases, full or partial refunds for undelivered units are automatically returned to your wallet balance.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
