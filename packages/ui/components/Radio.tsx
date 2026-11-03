import React from "react";

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: boolean;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className = "", label, error = false, disabled = false, checked, id, ...props }, ref) => {
    const generatedId = id || `radio-${Math.random().toString(36).substring(2, 9)}`;

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
            type="radio"
            checked={checked}
            disabled={disabled}
            aria-invalid={error}
            className="peer sr-only"
            {...props}
          />
          <div
            className={`w-5 h-5 rounded-full border transition-all flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 ${
              error
                ? "border-danger bg-danger-bg"
                : "border-border-control bg-surface hover:border-accent peer-checked:border-accent"
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-accent opacity-0 peer-checked:opacity-100 transition-opacity" />
          </div>
        </div>
        {label && <span className="font-normal">{label}</span>}
      </label>
    );
  }
);

Radio.displayName = "Radio";

