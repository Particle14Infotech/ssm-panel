import React from "react";
import type { Metadata } from "next";
import { CustomerLayoutWrapper } from "@/components/customer/CustomerLayoutWrapper";

export const metadata: Metadata = {
  title: "Dashboard | SMM PANEL",
  description: "Next-generation high-frequency social media marketing command center and real-time execution ledger.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <CustomerLayoutWrapper>{children}</CustomerLayoutWrapper>;
}
