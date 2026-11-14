"use client";

import React, { useState, useEffect } from "react";
import { AdminProviderWrapper } from "@/context/AdminContext";
import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";
import { SoftMeshGradient } from "@/components/shared/SoftMeshGradient";
import { getAuthToken, getUserRole } from "@/lib/auth-session";

export function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Eject non-admins or unauthenticated users immediately
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = getAuthToken();
      const role = getUserRole();
      if (!token || role !== "ADMIN") {
        window.location.replace("/login");
      }
    }
  }, []);

  return (
    <AdminProviderWrapper>
      <div className="min-h-screen bg-bg text-fg font-sans antialiased selection:bg-accent selection:text-on-accent flex relative overflow-x-clip transition-colors duration-200">
        <div className="ambient-glow-layer pointer-events-none" />
        <SoftMeshGradient intensity="subtle" />

        {/* Sidebar */}
        <AdminSidebar
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
          <AdminHeader onMenuToggle={() => setMobileSidebarOpen(true)} />
          <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 relative z-10">
            {children}
          </main>
        </div>
      </div>
    </AdminProviderWrapper>
  );
}
