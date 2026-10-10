"use client";

import React from "react";
import { CustomerProvider } from "@/context/CustomerContext";
import { CustomerHeader } from "./CustomerHeader";

export function CustomerLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <CustomerProvider>
      <div className="min-h-screen bg-[#0e0e0e] text-[#e5e2e1] font-sans antialiased selection:bg-[#DBEF90] selection:text-[#2a3400] flex flex-col">
        <CustomerHeader />
        <main className="flex-1 w-full pt-20">{children}</main>
      </div>
    </CustomerProvider>
  );
}
