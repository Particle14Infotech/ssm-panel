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

const formatEntityId = (prefix: string, id: string | undefined | null) =>
  !id ? `#${prefix}-00000000` : `#${prefix}-${id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`;

export const formatOrderId = (id?: string | null) => formatEntityId("ORD", id);
export const formatPackageId = (id?: string | null) => formatEntityId("PKG", id);
export const formatTxnId = (id?: string | null) => formatEntityId("TXN", id);
export const formatInvoiceId = (id?: string | null) => formatEntityId("INV", id);
export const formatTicketId = (id?: string | null) => formatEntityId("TKT", id);

export function formatServiceId(id: string | undefined | null): string {
  if (!id) return "#SRV-000";
  if (!id.includes("-") && id.length <= 6) return `#${id}`;
  const clean = id.replace(/^srv[-_]?/i, "").replace(/[^a-zA-Z0-9]/g, "");
  return `#SRV-${clean.slice(0, 8).toUpperCase()}`;
}



