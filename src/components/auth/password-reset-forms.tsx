"use client";

import Link from "next/link";
import { useState } from "react";
import { KeyRound, MailQuestion } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export function ForgotPasswordForm() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function sendReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        throw error;
      }
      setSent(true);
    } catch (caught) {
      toast({
        title: "Could not send reset email",
        description: caught instanceof Error ? caught.message : undefined,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-line bg-surface-muted p-4 text-sm leading-6 text-ink-muted">
        <p className="font-semibold text-ink">Check your email</p>
        <p className="mt-1">
          If an account exists for <span className="font-medium text-ink">{email}</span>, a password reset link is on
          its way.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={sendReset} className="grid gap-4">
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
      <Button type="submit" disabled={loading} className="mt-1 h-11 w-full">
        <MailQuestion size={16} aria-hidden="true" />
        {loading ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-ink-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-primary hover:text-primary-hover">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }
      toast({ title: "Password updated", variant: "success" });
      window.location.href = "/dashboard";
    } catch (caught) {
      setLoading(false);
      toast({
        title: "Could not update password",
        description:
          caught instanceof Error
            ? caught.message
            : "The reset link may have expired. Request a new one from the sign-in page.",
        variant: "error",
      });
    }
  }

  return (
    <form onSubmit={updatePassword} className="grid gap-4">
      <Field label="New password" htmlFor="password" hint="At least 8 characters">
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
        <KeyRound size={16} aria-hidden="true" />
        {loading ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}
