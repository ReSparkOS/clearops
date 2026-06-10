import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** Shared centered card layout for the login/signup/reset auth pages. */
export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md">
        <section className="rounded-2xl border border-line bg-surface p-7 shadow-card">
          <Image
            src="/brand/clearcloseiq-logo-primary.svg"
            alt="Clear Close IQ"
            width={342}
            height={59}
            priority
            className="h-auto w-full max-w-[300px]"
          />
          <h1 className="mt-6 text-xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1.5 text-sm leading-6 text-ink-muted">{description}</p>
          <div className="mt-6">{children}</div>
        </section>
        <p className="mt-4 text-center text-xs leading-5 text-ink-subtle">
          By using Clear Close IQ you agree to the{" "}
          <Link href="/legal/terms" className="font-medium underline-offset-2 hover:text-ink hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="font-medium underline-offset-2 hover:text-ink hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
