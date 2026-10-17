import React from "react";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { SmoothScroll } from "@/components/motion/SmoothScroll";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SmoothScroll>
      <div className="min-h-screen flex flex-col justify-between w-full relative z-10">
        <Navbar />
        <main className="flex-1 w-full">{children}</main>
        <Footer />
      </div>
    </SmoothScroll>
  );
}

