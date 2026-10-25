import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(num);
}

export function formatINR(amount: number | string, maximumFractionDigits = 2): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits,
  }).format(num);
}

export function formatOrderId(id: string | undefined | null): string {
  if (!id) return "#ORD-00000000";
  const clean = id.replace(/[^a-zA-Z0-9]/g, "");
  return `#ORD-${clean.slice(0, 8).toUpperCase()}`;
}

export function formatPackageId(id: string | undefined | null): string {
  if (!id) return "#PKG-00000000";
  const clean = id.replace(/[^a-zA-Z0-9]/g, "");
  return `#PKG-${clean.slice(0, 8).toUpperCase()}`;
}

export function formatTxnId(id: string | undefined | null): string {
  if (!id) return "#TXN-00000000";
  const clean = id.replace(/[^a-zA-Z0-9]/g, "");
  return `#TXN-${clean.slice(0, 8).toUpperCase()}`;
}

export function formatInvoiceId(id: string | undefined | null): string {
  if (!id) return "#INV-00000000";
  const clean = id.replace(/[^a-zA-Z0-9]/g, "");
  return `#INV-${clean.slice(0, 8).toUpperCase()}`;
}

export function formatTicketId(id: string | undefined | null): string {
  if (!id) return "#TKT-00000000";
  const clean = id.replace(/[^a-zA-Z0-9]/g, "");
  return `#TKT-${clean.slice(0, 8).toUpperCase()}`;
}

export function formatServiceId(id: string | undefined | null): string {
  if (!id) return "#SRV-000";
  if (!id.includes("-") && id.length <= 6) return `#${id}`;
  const clean = id.replace(/^srv[-_]?/i, "").replace(/[^a-zA-Z0-9]/g, "");
  return `#SRV-${clean.slice(0, 8).toUpperCase()}`;
}



