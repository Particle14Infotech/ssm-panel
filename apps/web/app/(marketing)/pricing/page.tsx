import React from "react";
import type { Metadata } from "next";
import { PricingSection } from "@/components/landing/PricingSection";

export const metadata: Metadata = {
  title: "Pricing & Deposit Bonuses | AETHER SMM",
  description: "Transparent per-1,000 rates and automatic wallet deposit bonus tiers for creators and agencies.",
};

export default function PricingPage() {
  return (
    <div className="w-full pt-20">
      <PricingSection />
    </div>
  );
}
