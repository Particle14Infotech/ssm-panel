import React from "react";
import type { Metadata } from "next";
import { ContactSection } from "@/components/landing/ContactSection";

export const metadata: Metadata = {
  title: "Contact Engineering Support | AETHER SMM",
  description: "Get in touch with the AETHER growth telemetry team for agency integrations, bulk volume, or technical support.",
};

export default function ContactPage() {
  return (
    <div className="w-full pt-20">
      <ContactSection />
    </div>
  );
}
