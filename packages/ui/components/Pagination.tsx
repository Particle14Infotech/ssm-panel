import React from "react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav
      aria-label="Pagination"
      className={`inline-flex items-center gap-1.5 p-1 rounded-xl bg-surface-raised border border-border select-none ${className}`}
    >
      <button
        type="button"
        aria-label="Previous page"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-2 hover:text-fg hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {pages.map((p) => {
        const isCurrent = p === currentPage;
        return (
          <button
            key={p}
            type="button"
            aria-label={`Page ${p}`}
            aria-current={isCurrent ? "page" : undefined}
            onClick={() => onPageChange(p)}
            className={`w-8 h-8 rounded-lg text-xs font-mono tabular-nums font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              isCurrent
                ? "bg-accent text-on-accent font-bold shadow-glow"
                : "text-fg-2 hover:text-fg hover:bg-surface"
            }`}
          >
            {p}
          </button>
        );
      })}

      <button
        type="button"
        aria-label="Next page"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-2 hover:text-fg hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </nav>
  );
}

