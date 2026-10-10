import React from "react";
import type { Metadata } from "next";
import { ServicesPreviewSection } from "@/components/landing/ServicesPreviewSection";

export const metadata: Metadata = {
  title: "Service Catalog | AETHER SMM",
  description: "Browse 500+ provider-synced social media marketing services with real-time rate per 1,000 calculation and instant dispatch.",
};

export default function ServicesPage() {
  return (
    <div className="w-full pt-20">
      <ServicesPreviewSection />
    </div>
  );
}
