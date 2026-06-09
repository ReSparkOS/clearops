import { getApiOrgContext } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/db/audit";
import { transactionBelongsToOrganization } from "@/lib/db/transactions";
import { getServerSupabaseConfig } from "@/lib/env";
import { DataAccessError, toErrorPayload } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Redirects to a short-lived signed URL for a stored packet document,
 * after verifying the caller's organization owns the transaction.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const context = await getApiOrgContext(request);
    if (!context) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const supabase = createAdminClient();
    const document = await supabase
      .from("documents")
      .select("id, transaction_id, storage_path, filename")
      .eq("id", id)
      .maybeSingle();

    if (document.error) {
      throw new DataAccessError(document.error.message, { code: document.error.code ?? undefined });
    }
    if (
      !document.data?.transaction_id ||
      !(await transactionBelongsToOrganization(document.data.transaction_id as string, context.organizationId))
    ) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }
    if (!document.data.storage_path) {
      return Response.json({ error: "No stored file for this document." }, { status: 404 });
    }

    const { storageBucket } = getServerSupabaseConfig();
    const signed = await supabase.storage
      .from(storageBucket)
      .createSignedUrl(document.data.storage_path as string, SIGNED_URL_TTL_SECONDS);

    if (signed.error || !signed.data?.signedUrl) {
      throw new DataAccessError(signed.error?.message ?? "Could not create a signed URL.");
    }

    await recordAuditEvent({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "document_viewed",
      transactionId: document.data.transaction_id as string,
      metadata: { documentId: id, filename: document.data.filename },
    });

    return Response.redirect(signed.data.signedUrl, 302);
  } catch (error) {
    const status = error instanceof DataAccessError ? error.status : 500;
    return Response.json(toErrorPayload(error), { status });
  }
}
