"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "success" | "error" | "info";
type ToastItem = { id: number; title: string; description?: string; variant: Variant };
type ToastInput = { title: string; description?: string; variant?: Variant; durationMs?: number };

const ToastContext = createContext<(input: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      counter += 1;
      const id = counter;
      const variant = input.variant ?? "info";
      setToasts((current) => [...current, { id, title: input.title, description: input.description, variant }]);
      const duration = input.durationMs ?? (variant === "error" ? 9000 : 4500);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const config = {
    success: { Icon: CheckCircle2, accent: "text-emerald-600", ring: "border-emerald-200" },
    error: { Icon: AlertTriangle, accent: "text-rose-600", ring: "border-rose-200" },
    info: { Icon: Info, accent: "text-primary", ring: "border-line-strong" },
  }[toast.variant];
  const { Icon } = config;

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface p-3.5 shadow-pop",
        config.ring,
      )}
    >
      <Icon size={18} className={cn("mt-0.5 shrink-0", config.accent)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 break-words text-xs leading-5 text-ink-muted">{toast.description}</p> : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-1 text-ink-subtle transition hover:bg-surface-muted hover:text-ink"
        aria-label="Dismiss notification"
      >
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
