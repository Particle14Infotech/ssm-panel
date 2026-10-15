import React from "react";
import { CustomerLayoutWrapper } from "@/components/customer/CustomerLayoutWrapper";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <CustomerLayoutWrapper>{children}</CustomerLayoutWrapper>;
}
