"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { CustomerProvider } from "@/context/CustomerContext";
import { CustomerSidebar } from "./CustomerSidebar";
import { CustomerHeader } from "./CustomerHeader";
import { CustomerBottomNav } from "./CustomerBottomNav";

export function CustomerLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard" || pathname === "/app/dashboard";

  return (
    <CustomerProvider>
      <div className="h-screen w-full bg-bg text-fg flex overflow-hidden relative transition-colors duration-200">
        {/* Ambient Glow Background Layer */}
        <div className="ambient-glow-layer" />

        {/* Desktop Glass Sidebar */}
        <CustomerSidebar />

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative z-10">
          {/* Header visible across all views - permanently pinned to top on mobile and desktop */}
          <CustomerHeader />
          <main
            id="customer-main-scroll"
            className={`flex-1 w-full max-w-[1560px] mx-auto overflow-y-auto ${isDashboard
                ? "p-3 sm:p-5 md:p-6 pb-28 lg:pb-16"
                : "p-3 sm:p-4 md:p-8 pb-32 lg:pb-16"
              }`}
          >
            {children}
          </main>
        </div>

        {/* Mobile Bottom Dock (< lg) */}
        <CustomerBottomNav />
      </div>
    </CustomerProvider>
  );
}
