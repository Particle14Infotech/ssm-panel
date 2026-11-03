import React from "react";

export interface ProgressBarProps {
  value: number; // 0 to 100
  label?: string;
  showPercent?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "accent" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export function ProgressBar({
  value,
  label,
  showPercent = false,
  size = "md",
  variant = "accent",
  className = "",
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const heightClasses = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  }[size];

  const variantBarClasses = {
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
  }[variant];

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {(label || showPercent) && (
        <div className="flex justify-between items-center text-xs">
          {label && <span className="font-medium text-fg-2">{label}</span>}
          {showPercent && (
            <span className="font-mono text-fg-muted tabular-nums">
              {Math.round(clampedValue)}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`w-full rounded-full bg-surface-raised border border-border overflow-hidden ${heightClasses}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${variantBarClasses}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}

