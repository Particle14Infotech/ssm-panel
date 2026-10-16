import React from "react";
import type { Metadata } from "next";

import { landingContent } from "@/content/landing";
import { Breadcrumb } from "@/components/shared/Breadcrumb";

export const metadata: Metadata = {
  title: "Privacy Policy & Data Protection",
  description: `Privacy and data protection policies for users and API consumers of ${landingContent.brand.name}.`,
  alternates: {
    canonical: "https://smmarchitecture.com/legal/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="w-full pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-10">
        <Breadcrumb items={[{ label: "Privacy Policy", href: "/legal/privacy" }]} />
        <span className="text-xs font-mono uppercase tracking-widest text-blue-400">
          Data Protection
        </span>
        <h1 className="font-heading text-4xl font-light text-white mt-2 mb-4">
          Privacy Policy
        </h1>
        <p className="text-xs font-mono text-slate-400">Last Updated: January 2025</p>
      </div>

      <div className="glass-panel rounded-2xl p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] flex flex-col gap-6 text-sm text-slate-300 leading-relaxed">
        <div>
          <h2 className="text-base font-semibold text-white mb-2">1. Information Collection</h2>
          <p>
            We collect basic account identifiers (email, username) and public target links necessary to fulfill requested orders. Passwords are encrypted with memory-hard Argon2id and provider API keys are encrypted at rest with AES-256-GCM.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white mb-2">2. Usage & Telemetry Data</h2>
          <p>
            System audit logs track order dispatches and administrative modifications to guarantee operational transparency and prevent unauthorized access. We never sell or share user data with third-party tracking networks.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white mb-2">3. Session Security</h2>
          <p>
            Authentication utilizes short-lived JWTs and rotating refresh tokens stored in httpOnly, Secure, SameSite=Lax cookies with automatic reuse detection to invalidate compromised sessions.
          </p>
        </div>
      </div>
    </div>
  );
}
