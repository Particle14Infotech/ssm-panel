import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error = false, disabled = false, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-3.5 flex items-center pointer-events-none text-fg-muted">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          disabled={disabled}
          aria-invalid={error}
          className={`w-full rounded-[14px] bg-surface text-fg placeholder:text-fg-muted px-4 py-2.5 text-sm transition-all border outline-none ${
            leftIcon ? "pl-10" : ""
          } ${rightIcon ? "pr-10" : ""} ${
            error
              ? "border-danger focus:ring-2 focus:ring-danger focus:ring-offset-2"
              : "border-border-control hover:border-accent-text focus:border-focus focus:ring-2 focus:ring-focus focus:ring-offset-2"
          } ${
            disabled ? "opacity-60 cursor-not-allowed bg-surface-raised text-fg-muted" : ""
          } ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 flex items-center text-fg-muted">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

