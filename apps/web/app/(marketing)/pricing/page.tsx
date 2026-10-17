import React from "react";
import type { Metadata } from "next";
import { ServicesPreviewSection } from "@/components/landing/ServicesPreviewSection";
import { Breadcrumb } from "@/components/shared/Breadcrumb";

export const metadata: Metadata = {
  title: "Pricing & Service Rates",
  description: "Transparent rates per 1,000 units with clear start times and quantity limits.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Pricing & Service Rates | SMM Panel",
    description: "Transparent rates per 1,000 units with clear start times and quantity limits.",
    url: "/pricing",
  },
};

export default function PricingPage() {
  return (
    <div className="w-full pt-28 pb-16">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 mb-8">
        <Breadcrumb items={[{ label: "Pricing", href: "/pricing" }]} />
        <h1 className="font-heading text-[clamp(32px,4vw,52px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-3">
          Pricing & <span className="text-[#D8EC8D]">Service Rates</span>
        </h1>
        <p className="text-[#A1A1AA] text-base leading-relaxed max-w-2xl">
          Transparent rates per 1,000 units with clear start times, min-max limits, and instant INR wallet top-ups.
        </p>
      </div>
      <ServicesPreviewSection />
    </div>
  );
}
