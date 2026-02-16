import { cn } from "@/lib/utils";

export function MacroCircle({
  label,
  value,
  goal,
  icon,
  color = "#10b981",
  className
}: {
  label: string;
  value: number;
  goal: number;
  icon?: string;
  color?: string;
  className?: string;
}) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const pct = goal <= 0 ? 0 : Math.max(0, Math.min(1, value / goal));
  const dash = circumference * pct;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative shrink-0">
        <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} strokeWidth="8" className="fill-none stroke-gray-200 dark:stroke-slate-800" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          strokeWidth="8"
          className="fill-none"
          stroke={color}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        </svg>
        {icon ? (
          <img
            src={icon}
            alt={label}
            className="pointer-events-none absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2"
          />
        ) : null}
      </div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-sm text-gray-600 dark:text-slate-400">
          {Math.round(value)} / {Math.round(goal)}
        </div>
      </div>
    </div>
  );
}
