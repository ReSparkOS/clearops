import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** Public document layout for legal pages — no app shell, readable measure. */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-canvas px-5 py-10">
      <article className="mx-auto w-full max-w-2xl">
        <Link href="/login" className="inline-flex items-center gap-2.5">
          <Image src="/brand/clearcloseiq-icon.svg" alt="" width={30} height={30} className="size-7" />
          <span className="text-sm font-semibold text-ink">Clear Close IQ</span>
        </Link>
        <div className="mt-6 rounded-xl border border-line bg-surface p-7 shadow-card sm:p-9">{children}</div>
        <p className="mt-6 text-center text-xs text-ink-subtle">
          <Link href="/legal/terms" className="font-medium hover:text-ink">
            Terms of Service
          </Link>
          {" · "}
          <Link href="/legal/privacy" className="font-medium hover:text-ink">
            Privacy Policy
          </Link>
        </p>
      </article>
    </main>
  );
}
