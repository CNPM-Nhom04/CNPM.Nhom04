import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, placeholder, id, ...props }, ref) => {
    const selectId = id || props.name;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={cn(
            "w-full h-9 rounded-md border bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer",
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
              : "border-slate-300 focus:border-blue-600",
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      </div>
    );
  },
);

Select.displayName = "Select";
