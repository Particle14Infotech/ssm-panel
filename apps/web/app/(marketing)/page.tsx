import React from "react";
import dynamic from "next/dynamic";
import { HeroSection } from "@/components/landing/HeroSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { WorkWalkthroughSection } from "@/components/landing/WorkWalkthroughSection";
import { ServicesPreviewSection } from "@/components/landing/ServicesPreviewSection";
import { PaymentsSection } from "@/components/landing/PaymentsSection";
import { BenefitsSection } from "@/components/landing/BenefitsSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { CtaSection } from "@/components/landing/CtaSection";

// Lazy-load TravelingCrownCanvas after first paint with instant poster fallback in the hero slot
const DynamicTravelingCrownCanvas = dynamic(
  () =>
    import("@/components/three/TravelingCrownCanvas").then(
      (mod) => mod.TravelingCrownCanvas
    ),
  {
    ssr: false,
    loading: () => null,
  }
);

export default function HomePage() {
  return (
    <div className="w-full flex flex-col items-center relative">
      {/* Exactly ONE fixed full-viewport transparent canvas across the entire page */}
      <DynamicTravelingCrownCanvas />

      {/* Sections with alternating deep near-black tokens and transparent/glass surfaces */}
      <div className="w-full flex flex-col items-center relative z-10">
        <HeroSection />
        <SocialProofSection />
        <WorkWalkthroughSection />
        <ServicesPreviewSection />
        <PaymentsSection />
        <BenefitsSection />
        <FaqSection />
        <CtaSection />
      </div>
    </div>
  );
}
