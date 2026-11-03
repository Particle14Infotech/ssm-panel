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

  let colorClasses = "bg-surface-raised text-fg-muted border-border";
  let dotColor = "bg-fg-muted";
  let label = status;

  switch (norm) {
    case "COMPLETED":
    case "PAID":
    case "RESOLVED":
    case "SUCCESS":
      colorClasses = "bg-success-bg text-success border-success/30";
      dotColor = "bg-success";
      label = norm === "PAID" ? "Paid" : norm === "RESOLVED" ? "Resolved" : "Completed";
      break;

    case "PROCESSING":
    case "IN_PROGRESS":
    case "ANSWERED":
      colorClasses = "bg-info-bg text-info border-info/30";
      dotColor = "bg-info";
      label = norm === "IN_PROGRESS" ? "In Progress" : norm === "ANSWERED" ? "Staff Reply" : "Processing";
      break;

    case "PARTIAL":
      colorClasses = "bg-warning-bg text-warning border-warning/30";
      dotColor = "bg-warning";
      label = "Partial";
      break;

    case "PENDING":
    case "CREATED":
    case "ATTEMPTED":
    case "OPEN":
      colorClasses = "bg-warning-bg text-warning border-warning/30";
      dotColor = "bg-warning";
      label = norm === "OPEN" ? "Open" : norm === "CREATED" ? "Created" : "Pending";
      break;

    case "CANCELLED":
    case "CANCELED":
    case "FAILED":
    case "EXPIRED":
    case "CLOSED":
      colorClasses = "bg-danger-bg text-danger border-danger/30";
      dotColor = "bg-danger";
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
