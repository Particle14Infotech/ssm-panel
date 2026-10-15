import React from "react";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { CustomCursor } from "@/components/motion/CustomCursor";

const DynamicCrownStage = dynamic(
  () => import("@/components/three/CrownStage").then((mod) => mod.CrownStage),
  { ssr: false }
);

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SmoothScroll>
      <CustomCursor />
      {/* Fixed Full-Page 3D Background Crown Stage */}
      <DynamicCrownStage />

      <div className="min-h-screen flex flex-col justify-between w-full relative z-10">
        <Navbar />
        <div className="flex-1 w-full">
          {children}
        </div>
        <Footer />
      </div>
    </SmoothScroll>
  );
}
