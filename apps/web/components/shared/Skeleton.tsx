"use client";

import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`bg-white/[0.05] animate-pulse rounded-xl border border-white/[0.04] ${className}`}
      {...props}
    />
  );
}
