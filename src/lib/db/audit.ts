import { createAdminClient, withSchemaCacheRetry } from "@/lib/supabase/server";

export type AuditAction =
  | "transaction_created"
  | "packet_upload"
  | "packet_rerun"
  | "flag_status_changed"
  | "document_viewed";

/**
 * Writes one row to audit_logs. Auditing must never take down the user-facing
 * operation it describes, so failures are logged and swallowed.
 */
export async function recordAuditEvent(input: {
  organizationId: string;
  actorId: string;
  action: AuditAction;
  transactionId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await withSchemaCacheRetry(() =>
      supabase.from("audit_logs").insert({
        organization_id: input.organizationId,
        transaction_id: input.transactionId ?? null,
        actor_id: input.actorId,
        action: input.action,
        metadata: input.metadata ?? {},
      }),
    );
    if (error) {
      console.error("[ClearCloseIQ] audit log write failed:", error.message);
    }
  } catch (error) {
    console.error("[ClearCloseIQ] audit log write failed:", error);
  }
}

/** Counts recent audit events for an org — the basis for extraction rate limiting. */
export async function countRecentAuditEvents(input: {
  organizationId: string;
  actions: AuditAction[];
  windowMs: number;
}): Promise<number> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - input.windowMs).toISOString();

  const { count, error } = await supabase
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .in("action", input.actions)
    .gte("created_at", since);

  if (error) {
    // Fail open on the counter (rate limiting is a guardrail, not a security boundary),
    // but loudly: a broken counter means the guardrail is offline.
    console.error("[ClearCloseIQ] rate-limit count failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

const EXTRACTION_ACTIONS: AuditAction[] = ["packet_upload", "packet_rerun"];

/** Returns an error message when the org has exhausted its hourly extraction budget, else null. */
export async function checkExtractionRateLimit(organizationId: string): Promise<string | null> {
  const limit = Number(process.env.EXTRACTION_RATE_LIMIT_PER_HOUR ?? 20);
  if (!Number.isFinite(limit) || limit <= 0) {
    return null;
  }

  const used = await countRecentAuditEvents({
    organizationId,
    actions: EXTRACTION_ACTIONS,
    windowMs: 60 * 60 * 1000,
  });

  if (used >= limit) {
    return `Extraction limit reached (${limit} packet runs per hour). Try again later.`;
  }
  return null;
}
