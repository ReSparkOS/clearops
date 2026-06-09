import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 shadow-card">
        <Image src="/brand/clearcloseiq-logo-primary.svg" alt="Clear Close IQ" width={342} height={59} priority className="h-auto w-full max-w-[300px]" />
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-ink">Sign in</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-muted">Access your transaction coordination workspace.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
