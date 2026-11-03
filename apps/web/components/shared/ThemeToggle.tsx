"use client";

import React, { useEffect, useState } from "react";
import { useTheme, ThemeMode } from "@/context/ThemeContext";

interface ThemeToggleProps {
  className?: string;
  variant?: "segmented" | "dropdown" | "compact";
  forceVisible?: boolean;
}

export function ThemeToggle({
  className = "",
  variant = "segmented",
  forceVisible = false,
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Theme toggle is universally enabled across dark and light environments
  const isEnabled = true;

  const modes: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
    {
      id: "dark",
      label: "Dark mode",
      icon: (
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      ),
    },
    {
      id: "light",
      label: "Light mode",
      icon: (
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ),
    },
    {
      id: "system",
      label: "System preference",
      icon: (
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      ),
    },
  ];

  if (!mounted) {
    return (
      <div
        className={`inline-flex items-center p-1 rounded-xl bg-surface-raised border border-border opacity-50 ${className}`}
        aria-hidden="true"
      >
        <div className="w-7 h-7 rounded-lg" />
        <div className="w-7 h-7 rounded-lg" />
        <div className="w-7 h-7 rounded-lg" />
      </div>
    );
  }

  if (variant === "compact") {
    const nextMode: ThemeMode =
      theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
    const currentLabel =
      theme === "system"
        ? `System (${resolvedTheme})`
        : theme === "dark"
        ? "Dark"
        : "Light";

    return (
      <button
        type="button"
        onClick={() => setTheme(nextMode)}
        aria-label={`Current theme: ${currentLabel}. Click to switch theme.`}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-xl bg-surface-raised border border-border text-fg hover:text-accent-text hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus transition-all ${className}`}
      >
        {resolvedTheme === "dark" ? modes[0].icon : modes[1].icon}
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={`inline-flex items-center p-1 rounded-xl bg-surface-raised border border-border ${className}`}
    >
      {modes.map((mode) => {
        const isSelected = theme === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={mode.label}
            title={mode.label}
            onClick={() => setTheme(mode.id)}
            className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              isSelected
                ? "bg-surface text-fg shadow-sm font-semibold border border-border"
                : "text-fg-muted hover:text-fg hover:bg-surface/50"
            }`}
          >
            {mode.icon}
          </button>
        );
      })}
    </div>
  );
}

