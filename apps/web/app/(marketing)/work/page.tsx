import React from "react";
import type { Metadata } from "next";
import { WorkWalkthroughSection } from "@/components/landing/WorkWalkthroughSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { landingContent } from "@/content/landing";

export const metadata: Metadata = {
  title: "How It Works — Order Lifecycle & Architecture",
  description: "Explore the 5-step order journey: wallet balance verification, clear catalog, provider outbox relay, and automated refill tracking.",
  alternates: {
    canonical: "https://smmarchitecture.com/work",
  },
  openGraph: {
    title: "How It Works — Order Lifecycle & Architecture | SMM PANEL",
    description: "Explore the 5-step order journey and automated provider order dispatch pipeline.",
    url: "https://smmarchitecture.com/work",
  },
};

export default function WorkPage() {
  return (
    <div className="w-full pt-28 pb-16 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <Breadcrumb items={[{ label: "How It Works", href: "/work" }]} />
        <h1 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight">
          How It Works — <span className="text-[#D8EC8D] font-normal">Order Architecture</span>
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base mt-2 max-w-2xl font-light">
          A transparent 5-stage pipeline engineered for real money safety and sub-second provider synchronization.
        </p>
      </div>
      <WorkWalkthroughSection />
      <SocialProofSection />
    </div>
  );
}
