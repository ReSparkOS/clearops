"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
);

export function LoginForm() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      if (!supabaseConfigured) {
        window.location.href = "/dashboard";
        return;
      }

      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        throw authError;
      }
      window.location.href = "/dashboard";
    } catch (caught) {
      setLoading(false);
      toast({
        title: "Could not sign in",
        description: caught instanceof Error ? caught.message : undefined,
        variant: "error",
      });
    }
  }

  return (
    <form onSubmit={signIn} className="grid gap-4">
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required={supabaseConfigured}
          autoComplete="email"
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required={supabaseConfigured}
          autoComplete="current-password"
        />
      </Field>
      <Button type="submit" disabled={loading} className="mt-1 h-11 w-full">
        <LogIn size={16} aria-hidden="true" />
        {supabaseConfigured ? "Sign in" : "Continue"}
      </Button>
    </form>
  );
}
