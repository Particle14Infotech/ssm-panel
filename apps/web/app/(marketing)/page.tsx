import React from "react";
import { HeroSection } from "@/components/landing/HeroSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { WorkWalkthroughSection } from "@/components/landing/WorkWalkthroughSection";
import { ServicesPreviewSection } from "@/components/landing/ServicesPreviewSection";
import { PaymentsSection } from "@/components/landing/PaymentsSection";
import { BenefitsSection } from "@/components/landing/BenefitsSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { CtaSection } from "@/components/landing/CtaSection";

export default function HomePage() {
  return (
    <div className="w-full flex flex-col items-center">
      <HeroSection />
      <SocialProofSection />
      <WorkWalkthroughSection />
      <ServicesPreviewSection />
      <PaymentsSection />
      <BenefitsSection />
      <FaqSection />
      <CtaSection />
    </div>
  );
}
