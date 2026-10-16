import React from "react";
import type { Metadata } from "next";
import { FaqSection } from "@/components/landing/FaqSection";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { landingContent } from "@/content/landing";

export const metadata: Metadata = {
  title: "Frequently Asked Questions & Knowledge Base",
  description: "Learn how order speeds, automated partial refunds, provider API policies, and double-entry ledger security operate.",
  alternates: {
    canonical: "https://smmarchitecture.com/faq",
  },
  openGraph: {
    title: "Frequently Asked Questions & Knowledge Base | SMM PANEL",
    description: "Learn how order speeds, automated partial refunds, and provider API policies function.",
    url: "https://smmarchitecture.com/faq",
  },
};

export default function FaqPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: landingContent.faq.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <div className="w-full pt-28 pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <Breadcrumb items={[{ label: "Knowledge Base (FAQ)", href: "/faq" }]} />
        <h1 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight">
          Frequently Asked <span className="text-[#3B82F6] font-normal">Questions</span>
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base mt-2 max-w-2xl font-light">
          Everything you need to know about order routing, balance safety, payment methods, and API integration.
        </p>
      </div>
      <FaqSection />
    </div>
  );
}
