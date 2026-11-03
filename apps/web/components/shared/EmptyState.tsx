import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  onActionClick?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionText,
  actionHref,
  onActionClick,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl bg-surface-glass border border-border backdrop-blur-md ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent-text mb-3 shadow-glow">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-fg tracking-wide">{title}</h3>
      <p className="text-xs text-fg-muted mt-1 max-w-sm leading-relaxed">{description}</p>
      {actionText && (
        <div className="mt-4">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-on-accent text-xs font-bold shadow-glow hover:brightness-105 transition-all"
            >
              {actionText}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onActionClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-on-accent text-xs font-bold shadow-glow hover:brightness-105 transition-all"
            >
              {actionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
