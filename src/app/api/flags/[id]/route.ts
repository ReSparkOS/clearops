import { z } from "zod";
import { getApiOrgContext } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/db/audit";
import { transactionBelongsToOrganization } from "@/lib/db/transactions";
import { DataAccessError, toErrorPayload } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/server";

const updateFlagSchema = z.object({
  status: z.enum(["open", "resolved", "false_positive", "needs_follow_up"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const context = await getApiOrgContext(request);
    if (!context) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const { status } = updateFlagSchema.parse(body);

    const supabase = createAdminClient();

    const existing = await supabase.from("packet_flags").select("id, transaction_id").eq("id", id).maybeSingle();
    if (existing.error) {
      throw new DataAccessError(existing.error.message, { code: existing.error.code ?? undefined });
    }
    if (
      !existing.data?.transaction_id ||
      !(await transactionBelongsToOrganization(existing.data.transaction_id as string, context.organizationId))
    ) {
      return Response.json({ error: "Flag not found." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("packet_flags")
      .update({
        status,
        resolved_by: status === "resolved" ? context.user.id : null,
        resolved_at: status === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();

    if (error) {
      throw new DataAccessError(error.message, { code: error.code ?? undefined });
    }
    if (!data) {
      return Response.json({ error: "Flag not found." }, { status: 404 });
    }

    await recordAuditEvent({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "flag_status_changed",
      transactionId: existing.data.transaction_id as string,
      metadata: { flagId: id, status },
    });

    return Response.json({ id: data.id, status: data.status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid flag status." }, { status: 400 });
    }
    const status = error instanceof DataAccessError ? error.status : 500;
    return Response.json(toErrorPayload(error), { status });
  }
}
