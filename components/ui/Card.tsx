import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "card-reveal rounded-3xl border border-white/80 bg-white/90 shadow-[0_14px_36px_rgba(125,160,60,0.10)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/75",
        className
      )}
      {...props}
    />
  );
}
