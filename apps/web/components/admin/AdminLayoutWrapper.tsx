"use client";

import React from "react";
import { AdminProviderWrapper } from "@/context/AdminContext";
import { AdminHeader } from "./AdminHeader";
import { SoftMeshGradient } from "@/components/shared/SoftMeshGradient";

export function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AdminProviderWrapper>
      <div className="min-h-screen bg-bg text-fg font-sans antialiased selection:bg-accent selection:text-on-accent flex flex-col relative overflow-x-clip transition-colors duration-200">
        <div className="ambient-glow-layer" />
        {/* Soft blurred 3D mesh-gradient */}
        <SoftMeshGradient intensity="medium" />

        <AdminHeader />
        <main className="flex-1 w-full pt-28 relative z-10">{children}</main>
      </div>
    </AdminProviderWrapper>
  );
}
