import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 disabled:pointer-events-none select-none";

    const variants = {
      primary: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
      secondary:
        "bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300",
      outline:
        "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100",
      destructive: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
      ghost:
        "bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-9 px-4 text-sm gap-2",
      lg: "h-11 px-6 text-base gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-current shrink-0" />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
