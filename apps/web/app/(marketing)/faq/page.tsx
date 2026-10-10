import React from "react";
import type { Metadata } from "next";
import { FaqSection } from "@/components/landing/FaqSection";

export const metadata: Metadata = {
  title: "Knowledge Base & FAQ | AETHER SMM",
  description: "Learn how order speeds, automated partial refunds, and provider API policies function.",
};

export default function FaqPage() {
  return (
    <div className="w-full pt-20">
      <FaqSection />
    </div>
  );
}
