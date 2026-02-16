"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "ghost" | "danger";
};

export function Button({ className, loading, disabled, variant = "primary", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold transition-all",
        "min-h-[44px] select-none",
        variant === "primary" &&
          "bg-gradient-to-r from-[#7da03c] to-[#e55f15] text-white shadow-[0_10px_24px_rgba(125,160,60,0.35)] hover:brightness-105 disabled:from-[#9ebc66] disabled:to-[#f08b54]",
        variant === "ghost" &&
          "bg-transparent text-gray-900 hover:bg-gray-100 dark:text-slate-50 dark:hover:bg-slate-800",
        variant === "danger" &&
          "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400 dark:hover:bg-red-500",
        "disabled:cursor-not-allowed disabled:opacity-80",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/50 border-t-white" /> : null}
      {props.children}
    </button>
  );
}
