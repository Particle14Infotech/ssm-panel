import React from "react";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "squircle" | "interactive" | "liquid";
  glow?: boolean;
}

/**
 * GlassCard - reusable dark minimal glassmorphic card component.
 * Features:
 * - Frosted glass with 1px hairline border at 10-15% white
 * - Subtle inner glow
 * - Soft long ambient shadows
 * - WCAG AA compliant contrast backing
 * - Optional squircle curvature
 */
export function GlassCard({
  children,
  className = "",
  variant = "default",
  glow = false,
  ...props
}: GlassCardProps) {
  const variantClasses = {
    default: "glass-card",
    squircle: "glass-squircle",
    interactive: "glass-card glass-card-hover",
    liquid: "liquid-glass",
  }[variant];

  return (
    <div
      className={`${variantClasses} relative ${glow ? "glow-lime" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
