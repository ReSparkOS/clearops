import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseConfig, getServerSupabaseConfig } from "@/lib/env";
import { DataAccessError, isSchemaCacheError } from "@/lib/errors";

export async function createClient() {
  const { url, publishableKey } = getPublicSupabaseConfig();

  if (!url || !publishableKey) {
    throw new DataAccessError("Supabase is not configured (missing URL or publishable key).");
  }

  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; Proxy refresh handles sessions.
        }
      },
    },
  });
}

export function createAdminClient() {
  const { url, secretKey } = getServerSupabaseConfig();

  if (!url || !secretKey) {
    throw new DataAccessError("Supabase admin client is not configured (missing URL or secret key).");
  }

  return createSupabaseClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

type SupabaseResult<T> = { data: T; error: { code?: string | null; message?: string } | null };

/**
 * Runs a Supabase query, retrying on PGRST205 ("table not in schema cache"). Newly
 * applied schemas leave PostgREST's cache briefly stale; PostgREST reloads on a short
 * delay, so a few backed-off retries recover automatically. If it never clears, the
 * caller gets the real error (with a fix-it hint) instead of silent fallback data.
 */
export async function withSchemaCacheRetry<T>(
  run: () => PromiseLike<SupabaseResult<T>>,
  attempts = 4,
): Promise<SupabaseResult<T>> {
  let result = await run();
  for (let attempt = 1; attempt < attempts && isSchemaCacheError(result.error); attempt += 1) {
    await delay(250 * attempt);
    result = await run();
  }
  return result;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
