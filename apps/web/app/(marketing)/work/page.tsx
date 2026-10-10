import React from "react";
import type { Metadata } from "next";
import { WorkWalkthroughSection } from "@/components/landing/WorkWalkthroughSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";

export const metadata: Metadata = {
  title: "How It Works & Live Telemetry | AETHER SMM",
  description: "Explore the outbox relay, transactional ledger, and automated provider synchronization pipeline.",
};

export default function WorkPage() {
  return (
    <div className="w-full pt-20 flex flex-col">
      <WorkWalkthroughSection />
      <SocialProofSection />
    </div>
  );
}
