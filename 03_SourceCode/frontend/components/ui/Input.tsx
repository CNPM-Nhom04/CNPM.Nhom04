import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "w-full h-9 rounded-md border bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors disabled:bg-slate-50 disabled:text-slate-400",
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
              : "border-slate-300 focus:border-blue-600",
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        {!error && helperText && (
          <p className="text-xs text-slate-500">{helperText}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
