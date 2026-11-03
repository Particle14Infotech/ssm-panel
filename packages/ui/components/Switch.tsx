import React from "react";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  id,
  className = "",
}: SwitchProps) {
  const generatedId = id || `switch-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <label
      htmlFor={generatedId}
      className={`inline-flex items-center gap-3 cursor-pointer select-none text-sm ${
        disabled ? "cursor-not-allowed opacity-60 text-fg-muted" : "text-fg hover:text-accent-text"
      } ${className}`}
    >
      <div className="relative">
        <input
          id={generatedId}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div
          className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out border peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 ${
            checked
              ? "bg-accent border-accent"
              : "bg-surface-raised border-border-control"
          }`}
        />
        <div
          className={`absolute left-0.5 top-0.5 w-5 h-5 rounded-full transition-transform duration-200 ease-in-out ${
            checked
              ? "translate-x-5 bg-on-accent shadow-sm"
              : "translate-x-0 bg-fg-muted shadow-sm"
          }`}
        />
      </div>
      {label && <span className="font-normal">{label}</span>}
    </label>
  );
}

