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
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-[#D8EC8D]/10 border border-[#D8EC8D]/20 flex items-center justify-center text-[#D8EC8D] mb-3 shadow-[0_0_20px_rgba(216,236,141,0.15)]">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-white tracking-wide">{title}</h3>
      <p className="text-xs text-zinc-400 mt-1 max-w-sm leading-relaxed">{description}</p>
      {actionText && (
        <div className="mt-4">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#D8EC8D] to-[#BEF264] text-[#171e00] text-xs font-bold shadow-lg shadow-[#D8EC8D]/20 hover:brightness-105 transition-all"
            >
              {actionText}
            </Link>
          ) : (
            <button
              onClick={onActionClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#D8EC8D] to-[#BEF264] text-[#171e00] text-xs font-bold shadow-lg shadow-[#D8EC8D]/20 hover:brightness-105 transition-all"
            >
              {actionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
