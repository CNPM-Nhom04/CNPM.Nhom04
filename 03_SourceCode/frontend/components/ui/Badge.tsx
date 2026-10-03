import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "draft"
    | "pending"
    | "approved"
    | "rejected"
    | "outline";
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide";

  const variants = {
    default: "bg-blue-100 text-blue-800 border border-blue-200",
    draft: "bg-slate-100 text-slate-700 border border-slate-200",
    pending: "bg-amber-100 text-amber-800 border border-amber-200",
    approved: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    rejected: "bg-rose-100 text-rose-800 border border-rose-200",
    outline: "border border-slate-300 text-slate-700 bg-transparent",
  };

  return (
    <span className={cn(baseStyles, variants[variant], className)} {...props}>
      {children}
    </span>
  );
}
