"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  highlight?: boolean;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  highlight = false,
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`glass-card p-6 flex flex-col justify-between h-full relative overflow-hidden transition-all duration-200 hover:border-accent/40 ${
        highlight ? "border-accent/40 shadow-glow" : ""
      } ${className}`}
    >
      {highlight && (
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-accent/10 blur-2xl pointer-events-none" />
      )}

      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-fg-muted font-sans">
          {title}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent-text shrink-0">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="text-2xl md:text-3xl font-semibold tracking-tight text-fg font-sans tabular-nums">
          {value}
        </div>

        {(subtitle || trend) && (
          <div className="flex items-center gap-2 pt-1 text-xs">
            {trend && (
              <span
                className={`font-sans font-medium tabular-nums ${
                  trend.isPositive ? "text-success" : "text-danger"
                }`}
              >
                {trend.isPositive ? "+" : "-"}
                {Math.abs(trend.value)}%
              </span>
            )}
            {subtitle && <span className="text-fg-muted text-[11px] font-sans">{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
