import React from "react";
import type { Metadata } from "next";
import { CustomerLayoutWrapper } from "@/components/customer/CustomerLayoutWrapper";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <CustomerLayoutWrapper>{children}</CustomerLayoutWrapper>;
}
