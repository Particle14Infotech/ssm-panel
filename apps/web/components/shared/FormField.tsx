"use client";

import React from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  error,
  helperText,
  required = false,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-xs font-medium text-fg-2">
        {label}
        {required && <span className="text-accent-text ml-1">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-danger font-mono">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-fg-muted font-mono">{helperText}</p>
      ) : null}
    </div>
  );
}
