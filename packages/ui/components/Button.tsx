import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "icon";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = "",
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseClasses =
      "inline-flex items-center justify-center font-medium rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 select-none";

    const sizeClasses = {
      sm: variant === "icon" ? "w-8 h-8 p-0" : "px-3 py-1.5 text-xs gap-1.5",
      md: variant === "icon" ? "w-10 h-10 p-0" : "px-4 py-2.5 text-sm gap-2",
      lg: variant === "icon" ? "w-12 h-12 p-0" : "px-6 py-3.5 text-base gap-2.5",
    }[size];

    const variantClasses = {
      primary:
        "bg-accent text-on-accent font-semibold border border-accent/20 hover:brightness-105 active:scale-[0.98] shadow-glow",
      secondary:
        "bg-surface-raised text-fg border border-border hover:bg-surface hover:border-border-control active:scale-[0.98]",
      ghost:
        "bg-transparent text-fg-2 hover:bg-surface-raised hover:text-fg active:bg-surface",
      danger:
        "bg-danger-bg text-danger border border-danger/30 hover:bg-danger hover:text-white active:scale-[0.98]",
      icon:
        "bg-surface-raised text-fg border border-border hover:bg-surface hover:text-accent-text hover:border-border-control",
    }[variant];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading}
        className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin w-4 h-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {!loading && leftIcon}
        <span>{children}</span>
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";

