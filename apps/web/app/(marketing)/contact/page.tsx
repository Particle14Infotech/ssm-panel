import React from "react";
import type { Metadata } from "next";
import { ContactSection } from "@/components/landing/ContactSection";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { landingContent } from "@/content/landing";

export const metadata: Metadata = {
  title: "Contact Support & Agency Enquiries",
  description: "Get in touch with our operations team for agency integrations, bulk volume discounts, or dedicated support assistance.",
  alternates: {
    canonical: "https://smmarchitecture.com/contact",
  },
  openGraph: {
    title: "Contact Support & Agency Enquiries | SMM PANEL",
    description: "Get in touch with our operations team for agency integrations or dedicated support.",
    url: "https://smmarchitecture.com/contact",
  },
};

export default function ContactPage() {
  return (
    <div className="w-full pt-28 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <Breadcrumb items={[{ label: "Contact", href: "/contact" }]} />
        <h1 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight">
          Contact <span className="text-[#3B82F6] font-normal">Support</span>
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base mt-2 max-w-2xl font-light">
          Dedicated engineer support for wholesale resellers, custom API pipelines, and high-volume accounts.
        </p>
      </div>
      <ContactSection />
    </div>
  );
}
