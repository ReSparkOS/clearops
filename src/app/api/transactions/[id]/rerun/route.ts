import { z } from "zod";
import { getApiOrgContext } from "@/lib/auth/session";
import { checkExtractionRateLimit, recordAuditEvent } from "@/lib/db/audit";
import { persistExtractionResult } from "@/lib/db/persistence";
import { transactionBelongsToOrganization } from "@/lib/db/transactions";
import { getServerSupabaseConfig } from "@/lib/env";
import { DataAccessError, toErrorPayload } from "@/lib/errors";
import { combinePipelineResults } from "@/lib/extraction/combine-results";
import { runExtractionPipeline, type ExtractionPipelineResult } from "@/lib/extraction/pipeline";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Optional override so the same stored packet can be re-extracted with a specific
// provider/model (used for model accuracy comparisons). Defaults to env configuration.
const rerunOptionsSchema = z.object({
  provider: z.enum(["openai", "anthropic"]).optional(),
  model: z.string().min(1).optional(),
});

// Re-runs extraction against the actual stored packet PDFs (downloaded from Supabase Storage).
// It never substitutes demo data — if nothing can be re-extracted, it surfaces an error.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const context = await getApiOrgContext(request);
    if (!context) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (!(await transactionBelongsToOrganization(id, context.organizationId))) {
      return Response.json({ error: "Transaction not found." }, { status: 404 });
    }

    const rateLimitError = await checkExtractionRateLimit(context.organizationId);
    if (rateLimitError) {
      return Response.json({ error: rateLimitError }, { status: 429 });
    }

    let options: z.infer<typeof rerunOptionsSchema> = {};
    const body = await request.text();
    if (body.trim()) {
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        return Response.json({ error: "Rerun options must be valid JSON." }, { status: 400 });
      }
      const parsed = rerunOptionsSchema.safeParse(json);
      if (!parsed.success) {
        return Response.json({ error: "Invalid rerun options. Expected { provider?, model? }." }, { status: 400 });
      }
      options = parsed.data;
    }

    await recordAuditEvent({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "packet_rerun",
      transactionId: id,
      metadata: options.provider ? { provider: options.provider, model: options.model ?? null } : {},
    });

    const supabase = createAdminClient();

    const { data: documents, error } = await supabase
      .from("documents")
      .select("filename, storage_path")
      .eq("transaction_id", id);

    if (error) {
      throw new DataAccessError(error.message, { code: error.code ?? undefined });
    }

    const stored = (documents ?? []).filter(
      (doc): doc is { filename: string; storage_path: string } => Boolean(doc.storage_path),
    );

    if (stored.length === 0) {
      return Response.json(
        { error: "No stored packet files to re-run. Upload the packet again to re-extract it." },
        { status: 400 },
      );
    }

    const { storageBucket } = getServerSupabaseConfig();
    const results: ExtractionPipelineResult[] = [];
    const storagePaths = new Map<string, string>();
    const warnings: string[] = [];
    const seenPaths = new Set<string>();

    for (const doc of stored) {
      if (seenPaths.has(doc.storage_path)) {
        continue;
      }
      seenPaths.add(doc.storage_path);

      const download = await supabase.storage.from(storageBucket).download(doc.storage_path);
      if (download.error || !download.data) {
        warnings.push(`Could not download ${doc.filename} from storage.`);
        continue;
      }

      const fileBuffer = Buffer.from(await download.data.arrayBuffer());
      storagePaths.set(doc.filename, doc.storage_path);

      const result = await runExtractionPipeline({
        filename: doc.filename,
        fileBuffer,
        provider: options.provider,
        model: options.model,
      });
      if (result.mode === "failed" && result.error) {
        warnings.push(`${doc.filename}: ${result.error}`);
      }
      results.push(result);
    }

    if (results.length === 0) {
      return Response.json({ error: "Could not download any stored packet files.", warnings }, { status: 502 });
    }

    const combined = combinePipelineResults(results);
    if (!combined) {
      return Response.json({ status: "failed", error: "Re-extraction produced no result.", warnings }, { status: 200 });
    }

    const persist = await persistExtractionResult({ transactionId: id, storagePaths, result: combined });

    return Response.json({
      processed: results.length,
      status: persist.status,
      mode: combined.mode,
      flags: persist.status === "saved" ? combined.health.flags.length : 0,
      error: persist.status === "failed" ? persist.error : undefined,
      warnings,
    });
  } catch (error) {
    const status = error instanceof DataAccessError ? error.status : 500;
    return Response.json(toErrorPayload(error), { status });
  }
}
