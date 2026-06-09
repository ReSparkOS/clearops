import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  tone?: "default" | "warn" | "bad" | "good";
}) {
  const valueTone = {
    default: "text-ink",
    warn: "text-amber-700",
    bad: "text-rose-700",
    good: "text-emerald-700",
  }[tone];

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">{label}</p>
        {icon ? <span className="text-ink-subtle">{icon}</span> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className={cn("text-2xl font-semibold tracking-tight", valueTone)}>{value}</p>
        {hint ? <p className="text-xs font-medium text-ink-muted">{hint}</p> : null}
      </div>
    </div>
  );
}
