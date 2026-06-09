import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 text-center shadow-card">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-muted text-ink-muted">
          <FileQuestion size={22} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-ink">Transaction not found</h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          This transaction doesn&apos;t exist or was removed. It is not shown as sample data.
        </p>
        <Link href="/dashboard" className={buttonVariants({ className: "mt-6" })}>
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
