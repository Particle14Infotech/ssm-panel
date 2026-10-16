"use client";

import React from "react";
import { AdminProviderWrapper } from "@/context/AdminContext";
import { AdminHeader } from "./AdminHeader";
import { SoftMeshGradient } from "@/components/shared/SoftMeshGradient";

export function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AdminProviderWrapper>
      <div className="min-h-screen bg-[#02040A] text-slate-200 font-sans antialiased selection:bg-blue-600 selection:text-white flex flex-col relative overflow-x-hidden">
        {/* Soft blurred 3D mesh-gradient: deep blue aura */}
        <SoftMeshGradient intensity="medium" />

        <AdminHeader />
        <main className="flex-1 w-full pt-28 relative z-10">{children}</main>
      </div>
    </AdminProviderWrapper>
  );
}
