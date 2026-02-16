import { cn } from "@/lib/utils";

export function MacroCircle({
  label,
  value,
  goal,
  className
}: {
  label: string;
  value: number;
  goal: number;
  className?: string;
}) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const pct = goal <= 0 ? 0 : Math.max(0, Math.min(1, value / goal));
  const dash = circumference * pct;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
        <circle cx="36" cy="36" r={radius} strokeWidth="8" className="fill-none stroke-gray-200 dark:stroke-slate-800" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          strokeWidth="8"
          className="fill-none stroke-primary"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-sm text-gray-600 dark:text-slate-400">
          {Math.round(value)} / {Math.round(goal)}
        </div>
      </div>
    </div>
  );
}

