"use client";

import React from "react";

export type SemanticStatus =
  | "PENDING"
  | "PROCESSING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PARTIAL"
  | "CANCELLED"
  | "FAILED"
  | "PAID"
  | "ATTEMPTED"
  | "CREATED"
  | "EXPIRED"
  | "OPEN"
  | "ANSWERED"
  | "RESOLVED"
  | "CLOSED";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const norm = status.toUpperCase().replace(/\s+/g, "_");

  let colorClasses = "bg-slate-500/10 text-slate-300 border-slate-500/20";
  let dotColor = "bg-slate-400";
  let label = status;

  switch (norm) {
    case "COMPLETED":
    case "PAID":
    case "RESOLVED":
    case "SUCCESS":
      colorClasses = "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
      dotColor = "bg-emerald-400";
      label = norm === "PAID" ? "Paid" : norm === "RESOLVED" ? "Resolved" : "Completed";
      break;

    case "PROCESSING":
    case "IN_PROGRESS":
    case "ANSWERED":
      colorClasses = "bg-[#D8EC8D]/15 text-[#D8EC8D] border-[#D8EC8D]/30";
      dotColor = "bg-[#D8EC8D]";
      label = norm === "IN_PROGRESS" ? "In Progress" : norm === "ANSWERED" ? "Staff Reply" : "Processing";
      break;

    case "PARTIAL":
      colorClasses = "bg-amber-500/15 text-amber-300 border-amber-500/30";
      dotColor = "bg-amber-400";
      label = "Partial";
      break;

    case "PENDING":
    case "CREATED":
    case "ATTEMPTED":
    case "OPEN":
      colorClasses = "bg-amber-500/15 text-amber-300 border-amber-500/30";
      dotColor = "bg-amber-400";
      label = norm === "OPEN" ? "Open" : norm === "CREATED" ? "Created" : "Pending";
      break;

    case "CANCELLED":
    case "CANCELED":
    case "FAILED":
    case "EXPIRED":
    case "CLOSED":
      colorClasses = "bg-rose-500/15 text-rose-300 border-rose-500/30";
      dotColor = "bg-rose-400";
      label = norm === "CLOSED" ? "Closed" : norm === "FAILED" ? "Failed" : "Cancelled";
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border backdrop-blur-md ${colorClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{label}</span>
    </span>
  );
}
