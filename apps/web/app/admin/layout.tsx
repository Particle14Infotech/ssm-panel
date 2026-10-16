import React from "react";
import type { Metadata } from "next";
import { AdminLayoutWrapper } from "@/components/admin/AdminLayoutWrapper";

export const metadata: Metadata = {
  title: "Admin Command Console | SMM PANEL",
  description: "Root administrative command center for high-frequency provider routing, revenue telemetry, and order settlement.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutWrapper>{children}</AdminLayoutWrapper>;
}
