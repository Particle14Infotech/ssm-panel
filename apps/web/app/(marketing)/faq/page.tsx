import React from "react";
import type { Metadata } from "next";
import { FaqSection } from "@/components/landing/FaqSection";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { landingContent } from "@/content/landing";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Straightforward answers about our services, order speeds, and automated wallet balance refunds.",
  alternates: {
    canonical: "/faq",
  },
  openGraph: {
    title: "Frequently Asked Questions | SMM Panel",
    description: "Straightforward answers about our services, order speeds, and automated wallet balance refunds.",
    url: "/faq",
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
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 mb-8">
        <Breadcrumb items={[{ label: "FAQ", href: "/faq" }]} />
        <h1 className="font-heading text-[clamp(32px,4vw,52px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-3">
          Frequently Asked <span className="text-[#D8EC8D]">Questions</span>
        </h1>
        <p className="text-[#A1A1AA] text-base leading-relaxed max-w-2xl">
          Clear answers about order dispatch, wallet deposits, supported payment methods, and automated refunds.
        </p>
      </div>
      <FaqSection />
    </div>
  );
}
