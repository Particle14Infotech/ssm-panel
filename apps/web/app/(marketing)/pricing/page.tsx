import React from "react";
import type { Metadata } from "next";
import { PricingSection } from "@/components/landing/PricingSection";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { landingContent } from "@/content/landing";

export const metadata: Metadata = {
  title: "Pricing Tiers & Deposit Bonuses",
  description: "Transparent volume rates and automatic wallet deposit bonus tiers for creators, agencies, and reseller networks.",
  alternates: {
    canonical: "https://smmarchitecture.com/pricing",
  },
  openGraph: {
    title: "Pricing Tiers & Deposit Bonuses | SMM PANEL",
    description: "Transparent volume rates and automatic wallet deposit bonus tiers.",
    url: "https://smmarchitecture.com/pricing",
  },
};

export default function PricingPage() {
  return (
    <div className="w-full pt-28 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <Breadcrumb items={[{ label: "Pricing", href: "/pricing" }]} />
        <h1 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight">
          Pricing Tiers & <span className="text-[#3B82F6] font-normal">Bonus Top-Ups</span>
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base mt-2 max-w-2xl font-light">
          Scale your balance with automated top-up incentives from Bronze to Diamond agency accounts.
        </p>
      </div>
      <PricingSection />
    </div>
  );
}
