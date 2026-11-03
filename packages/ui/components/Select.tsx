import React from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", error = false, disabled = false, options, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          disabled={disabled}
          aria-invalid={error}
          className={`w-full appearance-none rounded-[14px] bg-surface text-fg px-4 py-2.5 pr-10 text-sm transition-all border outline-none ${
            error
              ? "border-danger focus:ring-2 focus:ring-danger focus:ring-offset-2"
              : "border-border-control hover:border-accent-text focus:border-focus focus:ring-2 focus:ring-focus focus:ring-offset-2"
          } ${
            disabled ? "opacity-60 cursor-not-allowed bg-surface-raised text-fg-muted" : ""
          } ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              disabled={opt.disabled}
              className="bg-surface text-fg"
            >
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-fg-muted">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }
);

Select.displayName = "Select";

