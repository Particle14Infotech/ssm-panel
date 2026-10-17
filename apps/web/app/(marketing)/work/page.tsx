import React from "react";
import type { Metadata } from "next";
import { WorkWalkthroughSection } from "@/components/landing/WorkWalkthroughSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { Breadcrumb } from "@/components/shared/Breadcrumb";

export const metadata: Metadata = {
  title: "How It Works — Order Lifecycle & Fulfillment",
  description: "Explore the 4-step order journey: add funds in INR, choose service, place order, and track with automatic refunds.",
  alternates: {
    canonical: "/work",
  },
  openGraph: {
    title: "How It Works — Order Lifecycle & Fulfillment | SMM Panel",
    description: "Explore the 4-step order journey with transparent wallet payments and live tracking.",
    url: "/work",
  },
};

export default function WorkPage() {
  return (
    <div className="w-full pt-28 pb-16 flex flex-col">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 mb-8">
        <Breadcrumb items={[{ label: "How It Works", href: "/work" }]} />
        <h1 className="font-heading text-[clamp(32px,4vw,52px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-3">
          How It Works — <span className="text-[#D8EC8D]">Order Flow</span>
        </h1>
        <p className="text-[#A1A1AA] text-base leading-relaxed max-w-2xl">
          A straightforward 4-step process from deposit to delivery with live order tracking and automatic wallet refunds.
        </p>
      </div>
      <WorkWalkthroughSection />
      <SocialProofSection />
    </div>
  );
}
