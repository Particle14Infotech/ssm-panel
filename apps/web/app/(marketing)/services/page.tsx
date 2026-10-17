import React from "react";
import type { Metadata } from "next";
import { ServicesPreviewSection } from "@/components/landing/ServicesPreviewSection";
import { Breadcrumb } from "@/components/shared/Breadcrumb";

export const metadata: Metadata = {
  title: "Services Catalog & Real-Time Rates",
  description: "Browse social media growth services with upfront rates per 1,000, clear speed estimates, and live dispatch.",
  alternates: {
    canonical: "/services",
  },
  openGraph: {
    title: "Services Catalog & Real-Time Rates | SMM Panel",
    description: "Browse social media growth services with upfront rates per 1,000 and live dispatch.",
    url: "/services",
  },
};

export default function ServicesPage() {
  return (
    <div className="w-full pt-28 pb-16">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 mb-8">
        <Breadcrumb items={[{ label: "Services", href: "/services" }]} />
        <h1 className="font-heading text-[clamp(32px,4vw,52px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-3">
          Services Catalog & <span className="text-[#D8EC8D]">Rates</span>
        </h1>
        <p className="text-[#A1A1AA] text-base leading-relaxed max-w-2xl">
          Upfront rates per 1,000 units in INR, clear speed estimates, and automatic refunds on unfulfilled units.
        </p>
      </div>
      <ServicesPreviewSection />
    </div>
  );
}
