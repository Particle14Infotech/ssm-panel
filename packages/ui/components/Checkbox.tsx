import React from "react";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = "", label, error = false, disabled = false, checked, id, ...props }, ref) => {
    const generatedId = id || `checkbox-${Math.random().toString(36).substring(2, 9)}`;

    return (
      <label
        htmlFor={generatedId}
        className={`inline-flex items-center gap-2.5 cursor-pointer select-none text-sm ${
          disabled ? "cursor-not-allowed opacity-60 text-fg-muted" : "text-fg hover:text-accent-text"
        } ${className}`}
      >
        <div className="relative flex items-center justify-center">
          <input
            ref={ref}
            id={generatedId}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            aria-invalid={error}
            className="peer sr-only"
            {...props}
          />
          <div
            className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 ${
              error
                ? "border-danger bg-danger-bg"
                : "border-border-control bg-surface hover:border-accent peer-checked:bg-accent peer-checked:border-accent"
            }`}
          >
            <svg
              className="w-3.5 h-3.5 text-on-accent opacity-0 peer-checked:opacity-100 transition-opacity"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
        {label && <span className="font-normal">{label}</span>}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";

