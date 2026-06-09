"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { SCHEMA_CACHE_HINT } from "@/lib/errors";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[ClearCloseIQ] render error:", error);
  }, [error]);

  const looksLikeSchemaCache = /schema cache|PGRST205|could not find the table/i.test(error.message);

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-line bg-surface p-7 shadow-card">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-rose-50 text-rose-600">
            <AlertTriangle size={20} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-ink">Something went wrong loading data</h1>
            <p className="text-sm text-ink-muted">The app shows real errors instead of demo data.</p>
          </div>
        </div>

        <p className="mt-5 rounded-lg border border-line bg-surface-muted p-3 font-mono text-xs leading-5 text-ink">
          {error.message || "Unknown error."}
        </p>

        {looksLikeSchemaCache ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            <p className="font-semibold">Likely fix</p>
            <p className="mt-1">{SCHEMA_CACHE_HINT}</p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" onClick={reset}>
            <RefreshCw size={16} aria-hidden="true" />
            Try again
          </Button>
          <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
