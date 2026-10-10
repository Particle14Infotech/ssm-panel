import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | AETHER SMM",
  description: "Terms and conditions governing the use of the AETHER SMM platform and provider API services.",
};

export default function TermsPage() {
  return (
    <div className="w-full pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-10">
        <span className="text-xs font-mono uppercase tracking-widest text-[#d8ec8d]">
          Legal Documentation
        </span>
        <h1 className="font-heading text-4xl font-light text-white mt-2 mb-4">
          Terms of Service
        </h1>
        <p className="text-xs font-mono text-[#c7c8b6]">Last Updated: January 2025</p>
      </div>

      <div className="rounded-3xl p-8 bg-[#1c1b1b]/80 border border-white/10 flex flex-col gap-6 text-sm text-[#c7c8b6] leading-relaxed">
        <div>
          <h2 className="text-base font-semibold text-white mb-2">1. Compliance & Authorized Fulfilment</h2>
          <p>
            AETHER SMM operates strictly through authorized provider APIs where permitted by the platform and service provider. We do not participate in credential harvesting, bot account creation, CAPTCHA bypassing, or platform security circumvention.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white mb-2">2. Service Availability & Delivery Rates</h2>
          <p>
            Service availability and processing speeds are determined in real-time by provider networks. While our systems continuously monitor shard throughput and balance, estimated start times and delivery rates are averages and not fixed guarantees.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white mb-2">3. Wallet Ledger & Account Balance</h2>
          <p>
            Account balances represent internal service credits. Every debit and refund is processed through an immutable database ledger with unique idempotency keys to ensure balance integrity.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white mb-2">4. Admin Intervention & Service Suspension</h2>
          <p>
            Platform administrators reserve the right to disable, re-route, or cancel any service or order at any time to preserve system integrity or comply with network policies. In such cases, full or partial ledger refunds are automatically credited.
          </p>
        </div>
      </div>
    </div>
  );
}
