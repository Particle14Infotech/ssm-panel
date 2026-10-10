import React from "react";
import { HeroSection } from "@/components/landing/HeroSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { BenefitsSection } from "@/components/landing/BenefitsSection";
import { ServicesPreviewSection } from "@/components/landing/ServicesPreviewSection";
import { WorkWalkthroughSection } from "@/components/landing/WorkWalkthroughSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { ContactSection } from "@/components/landing/ContactSection";

export default function HomePage() {
  return (
    <div className="w-full flex flex-col items-center">
      <HeroSection />
      <SocialProofSection />
      <BenefitsSection />
      <ServicesPreviewSection />
      <WorkWalkthroughSection />
      <PricingSection />
      <FaqSection />
      <ContactSection />
    </div>
  );
}
