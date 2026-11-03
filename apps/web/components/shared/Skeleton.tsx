"use client";

import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`bg-surface-raised animate-pulse rounded-xl border border-border/50 ${className}`}
      {...props}
    />
  );
}
