import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const controlClass =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink shadow-card outline-none transition-colors placeholder:text-ink-subtle hover:border-line-strong focus:border-primary disabled:opacity-60";

export const labelClass = "text-xs font-semibold uppercase tracking-wide text-ink-subtle";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(controlClass, className)} {...props} />;
}
