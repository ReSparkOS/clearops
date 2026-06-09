// Centralized error model. The app is Supabase-or-visible-error: data failures must
// surface to the user with the real reason, never be swallowed into demo/local data.

export type DataErrorCode = string | undefined;

export class DataAccessError extends Error {
  code: DataErrorCode;
  hint?: string;
  status: number;

  constructor(message: string, opts: { code?: DataErrorCode; hint?: string; status?: number } = {}) {
    super(message);
    this.name = "DataAccessError";
    this.code = opts.code;
    this.hint = opts.hint ?? hintForCode(opts.code);
    this.status = opts.status ?? 500;
  }
}

export const SCHEMA_CACHE_HINT =
  "Supabase can't see the database tables yet (PostgREST schema cache). In the Supabase dashboard SQL editor, run the contents of supabase/schema.sql, then run: NOTIFY pgrst, 'reload schema';";

export function hintForCode(code: DataErrorCode): string | undefined {
  if (code === "PGRST205" || code === "PGRST204") {
    return SCHEMA_CACHE_HINT;
  }
  return undefined;
}

export function isSchemaCacheError(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === "PGRST205";
}

// Shape returned to clients from API routes so the UI can show a real toast.
export function toErrorPayload(error: unknown): { error: string; code?: string; hint?: string } {
  if (error instanceof DataAccessError) {
    return { error: error.message, code: error.code, hint: error.hint };
  }
  if (error instanceof Error) {
    return { error: error.message };
  }
  return { error: "Unexpected error." };
}
