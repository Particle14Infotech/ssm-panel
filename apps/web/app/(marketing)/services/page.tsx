import React from "react";
import type { Metadata } from "next";
import { ServicesPreviewSection } from "@/components/landing/ServicesPreviewSection";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { landingContent } from "@/content/landing";

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <Breadcrumb items={[{ label: "Services", href: "/services" }]} />
        <h1 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight">
          Verified <span className="text-[#D8EC8D] font-normal">Services Matrix</span>
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base mt-2 max-w-2xl font-light">
          Real-time rates per 1,000 units, instant provider sync status, and deterministic ledger accounting.
        </p>
      </div>
      <ServicesPreviewSection />
    </div>
  );
}
