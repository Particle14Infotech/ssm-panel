"use client";

import React from "react";
import { CustomerProvider } from "@/context/CustomerContext";
import { CustomerHeader } from "./CustomerHeader";
import { SoftMeshGradient } from "@/components/shared/SoftMeshGradient";
import { MobileBottomNav } from "@/components/shared/MobileBottomNav";

export function CustomerLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <CustomerProvider>
      <div className="min-h-screen bg-[#0e0e0e] text-[#e5e2e1] font-sans antialiased selection:bg-[#DBEF90] selection:text-[#2a3400] flex flex-col relative overflow-x-hidden">
        {/* Soft blurred 3D mesh-gradient: lime #243100 to #DBEF90 bloom */}
        <SoftMeshGradient intensity="medium" />

        <CustomerHeader />
        <main className="flex-1 w-full pt-20 relative z-10">{children}</main>
        <MobileBottomNav />
      </div>
    </CustomerProvider>
  );
}
