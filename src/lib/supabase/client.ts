"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/env";

export function createClient() {
  const { url, publishableKey } = getPublicSupabaseConfig();

  if (!url || !publishableKey) {
    throw new Error("Supabase browser client is not configured.");
  }

  return createBrowserClient(url, publishableKey);
}
