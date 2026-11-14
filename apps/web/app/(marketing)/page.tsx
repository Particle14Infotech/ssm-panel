import React from "react";
import dynamic from "next/dynamic";
import { HeroSection } from "@/components/landing/HeroSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { WorkWalkthroughSection } from "@/components/landing/WorkWalkthroughSection";
import { LandingPromoCarousel } from "@/components/landing/LandingPromoCarousel";
import { LandingComboShowcase } from "@/components/landing/LandingComboShowcase";
import { PaymentsSection } from "@/components/landing/PaymentsSection";
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
    <div className="w-full flex flex-col items-center relative overflow-hidden">
      {/* Exactly ONE fixed full-viewport transparent canvas across the entire page */}
      <DynamicTravelingCrownCanvas />

      {/* Atmospheric Ambient Gradient Glow for Light & Dark Mode */}
      {/* Light Mode: Elegant subtle lime aura (#D8EC8D / #D4F55F at 10-18% opacity) across hero & combo showcase */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[650px] bg-[radial-gradient(ellipse_at_center,rgba(216,236,141,0.22)_0%,rgba(212,245,95,0.08)_45%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(216,236,141,0.06)_0%,transparent_70%)] blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />
      <div
        className="absolute top-[1800px] left-1/3 -translate-x-1/2 w-[900px] h-[550px] bg-[radial-gradient(ellipse_at_center,rgba(216,236,141,0.18)_0%,rgba(212,245,95,0.05)_45%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(216,236,141,0.04)_0%,transparent_70%)] blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />
      <div
        className="absolute top-[3200px] right-1/4 translate-x-1/2 w-[800px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(216,236,141,0.14)_0%,rgba(212,245,95,0.04)_45%,transparent_70%)] dark:bg-transparent blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      {/* Sections with alternating semantic tokens and transparent/glass surfaces */}
      <div className="w-full flex flex-col items-center relative z-10">
        <HeroSection />
        <SocialProofSection />
        <WorkWalkthroughSection />
        <LandingPromoCarousel />
        <LandingComboShowcase />
        <PaymentsSection />
        <FaqSection />
        <CtaSection />
      </div>
    </div>
  );
}
