import React from "react";
import type { Metadata } from "next";
import { ServicesPreviewSection } from "@/components/landing/ServicesPreviewSection";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { landingContent } from "@/content/landing";

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <Breadcrumb items={[{ label: "Pricing", href: "/pricing" }]} />
        <h1 className="font-heading text-3xl sm:text-5xl font-semibold text-white tracking-tight">
          Pricing & <span className="text-[#D8EC8D]">Service Rates</span>
        </h1>
        <p className="text-[#A1A1AA] text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
          Transparent rates per 1,000 units with clear start times and quantity limits.
        </p>
      </div>
      <ServicesPreviewSection />
    </div>
  );
}
