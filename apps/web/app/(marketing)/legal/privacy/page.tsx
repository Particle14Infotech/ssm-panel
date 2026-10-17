import React from "react";
import type { Metadata } from "next";
import { landingContent } from "@/content/landing";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { Reveal } from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "Privacy Policy & Data Protection",
  description: `Privacy and data protection policies for users and API consumers of ${landingContent.brand.name}.`,
  alternates: {
    canonical: "/legal/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="w-full pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <Reveal y={0} delay={0.05}>
        <div className="mb-10">
          <Breadcrumb items={[{ label: "Privacy Policy", href: "/legal/privacy" }]} />
          <span className="text-xs font-mono uppercase tracking-widest text-[#D8EC8D]">
            Data Protection
          </span>
          <h1 className="font-heading text-4xl font-semibold text-white mt-2 mb-4">
            Privacy Policy
          </h1>
          <p className="text-xs font-mono text-[#A1A1AA]">Last Updated: January 2025</p>
        </div>

        <div className="rounded-[20px] bg-white/[0.03] border border-white/[0.08] p-8 flex flex-col gap-6 text-sm text-[#A1A1AA] leading-relaxed">
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
      </Reveal>
    </div>
  );
}
