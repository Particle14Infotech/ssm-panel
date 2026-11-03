import React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", error = false, disabled = false, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        disabled={disabled}
        aria-invalid={error}
        className={`w-full rounded-[14px] bg-surface text-fg placeholder:text-fg-muted px-4 py-2.5 text-sm transition-all border outline-none resize-y min-h-[96px] ${
          error
            ? "border-danger focus:ring-2 focus:ring-danger focus:ring-offset-2"
            : "border-border-control hover:border-accent-text focus:border-focus focus:ring-2 focus:ring-focus focus:ring-offset-2"
        } ${
          disabled ? "opacity-60 cursor-not-allowed bg-surface-raised text-fg-muted" : ""
        } ${className}`}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

