"use client";

import React from "react";
import { AdminProviderWrapper } from "@/context/AdminContext";
import { AdminHeader } from "./AdminHeader";
import { SoftMeshGradient } from "@/components/shared/SoftMeshGradient";

export function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AdminProviderWrapper>
      <div className="min-h-screen bg-[#0e0e0e] text-[#e5e2e1] font-sans antialiased selection:bg-[#DBEF90] selection:text-[#2a3400] flex flex-col relative overflow-x-hidden">
        {/* Soft blurred 3D mesh-gradient: lime #243100 to #DBEF90 bloom */}
        <SoftMeshGradient intensity="medium" />

        <AdminHeader />
        <main className="flex-1 w-full pt-28 relative z-10">{children}</main>
      </div>
    </AdminProviderWrapper>
  );
}
