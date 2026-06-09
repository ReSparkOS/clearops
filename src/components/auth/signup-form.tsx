"use client";

import Link from "next/link";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export function SignupForm() {
  const toast = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function signUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() || null },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) {
        throw error;
      }

      if (data.session) {
        window.location.href = "/dashboard";
        return;
      }

      setAwaitingConfirmation(true);
    } catch (caught) {
      toast({
        title: "Could not create account",
        description: caught instanceof Error ? caught.message : undefined,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  if (awaitingConfirmation) {
    return (
      <div className="rounded-lg border border-line bg-surface-muted p-4 text-sm leading-6 text-ink-muted">
        <p className="font-semibold text-ink">Check your email</p>
        <p className="mt-1">
          We sent a confirmation link to <span className="font-medium text-ink">{email}</span>. Confirm your address,
          then sign in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={signUp} className="grid gap-4">
      <Field label="Full name" htmlFor="fullName" hint="Used to name your workspace">
        <Input
          id="fullName"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          autoComplete="name"
        />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
        />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters">
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>
      <Button type="submit" disabled={loading} className="mt-1 h-11 w-full">
        <UserPlus size={16} aria-hidden="true" />
        {loading ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:text-primary-hover">
          Sign in
        </Link>
      </p>
    </form>
  );
}
