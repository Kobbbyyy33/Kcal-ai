import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  max,
  className
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("h-3 w-full rounded-full bg-gray-200 dark:bg-slate-800", className)}>
      <div
        className="h-3 rounded-full bg-primary transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

