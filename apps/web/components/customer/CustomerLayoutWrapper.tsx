"use client";

import React from "react";
import { CustomerProvider } from "@/context/CustomerContext";
import { CustomerSidebar } from "./CustomerSidebar";
import { CustomerHeader } from "./CustomerHeader";

export function CustomerLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <CustomerProvider>
      <div className="min-h-screen bg-[#131313] text-slate-100 flex">
        {/* Desktop Glass Sidebar */}
        <CustomerSidebar />

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0">
          <CustomerHeader />
          <main className="flex-1 w-full p-4 md:p-8 relative z-10 max-w-[1560px] mx-auto">
            {children}
          </main>
        </div>
      </div>
    </CustomerProvider>
  );
}
