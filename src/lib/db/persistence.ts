import type { ExtractionPipelineResult } from "@/lib/extraction/pipeline";
import type { PacketStatus } from "@/lib/domain/types";
import { toIsoDate } from "@/lib/domain/dates";
import { DataAccessError } from "@/lib/errors";
import { createAdminClient, withSchemaCacheRetry } from "@/lib/supabase/server";

export type PersistResult =
  | { status: "saved"; documentCount: number }
  | { status: "failed"; error: string };

export async function persistExtractionResult(input: {
  transactionId: string;
  storagePaths?: Map<string, string>;
  result: ExtractionPipelineResult;
}): Promise<PersistResult> {
  if (!isUuid(input.transactionId)) {
    throw new DataAccessError("Unknown transaction id.", { status: 404 });
  }

  const supabase = createAdminClient();
  const result = input.result;

  // Never persist fabricated or empty data on a failed extraction. Mark the packet as errored
  // and leave any previously-stored real data untouched.
  if (result.mode === "failed") {
    const { error } = await withSchemaCacheRetry(() =>
      supabase
        .from("transactions")
        .update({ packet_status: "error", updated_at: new Date().toISOString() })
        .eq("id", input.transactionId),
    );
    if (error) {
      throw asDataAccessError(error, "Could not update transaction status.");
    }
    return { status: "failed", error: result.error ?? "Extraction failed." };
  }

  const extraction = result.extraction;

  // Preserve human review decisions across re-extraction by matching flags on a natural key.
  const existingFlags = await withSchemaCacheRetry(() =>
    supabase
      .from("packet_flags")
      .select("category, title, source_page, required_document, status")
      .eq("transaction_id", input.transactionId),
  );
  if (existingFlags.error) {
    throw asDataAccessError(existingFlags.error, "Could not read existing flags.");
  }
  const statusByKey = new Map<string, string>();
  for (const flag of (existingFlags.data ?? []) as ExistingFlagRow[]) {
    statusByKey.set(flagKey(flag.category, flag.title, flag.source_page, flag.required_document), flag.status);
  }

  await deleteExistingPacketData(supabase, input.transactionId);

  const documentInsert = extraction.documents.map((document) => ({
    transaction_id: input.transactionId,
    filename: document.filename,
    storage_path: input.storagePaths?.get(document.filename) ?? null,
    document_type: document.documentType,
    classification_confidence: document.confidence,
    page_start: document.pageStart,
    page_end: document.pageEnd,
    status: "processed",
  }));

  if (documentInsert.length > 0) {
    const { error } = await withSchemaCacheRetry(() => supabase.from("documents").insert(documentInsert));
    if (error) {
      throw asDataAccessError(error, "Could not save documents.");
    }
  }

  const { error: extractionError } = await withSchemaCacheRetry(() =>
    supabase.from("extracted_transaction_fields").insert({
      transaction_id: input.transactionId,
      schema_version: extraction.schemaVersion,
      extracted_fields: extraction.facts,
      // The raw model response can be large and contains untrusted packet text; we do not persist it.
      raw_ai_response: null,
      confidence: averageDocumentConfidence(extraction.documents),
    }),
  );
  if (extractionError) {
    throw asDataAccessError(extractionError, "Could not save extracted fields.");
  }

  if (result.health.flags.length > 0) {
    const flagsInsert = result.health.flags.map((flag) => ({
      transaction_id: input.transactionId,
      category: flag.category,
      severity: flag.severity,
      title: flag.title,
      explanation: flag.explanation,
      suggested_action: flag.suggestedAction,
      status: statusByKey.get(flagKey(flag.category, flag.title, flag.sourcePage ?? null, flag.requiredDocument ?? null)) ?? flag.status,
      confidence: flag.confidence,
      source: flag.source,
      source_page: flag.sourcePage,
      required_document: flag.requiredDocument,
    }));

    const { error: flagsError } = await withSchemaCacheRetry(() => supabase.from("packet_flags").insert(flagsInsert));
    if (flagsError) {
      throw asDataAccessError(flagsError, "Could not save flags.");
    }
  }

  const { error: transactionError } = await withSchemaCacheRetry(() =>
    supabase.from("transactions").update(transactionUpdateFromExtraction(result)).eq("id", input.transactionId),
  );
  if (transactionError) {
    throw asDataAccessError(transactionError, "Could not update transaction.");
  }

  return { status: "saved", documentCount: documentInsert.length };
}

export function transactionUpdateFromExtraction(result: Pick<ExtractionPipelineResult, "extraction" | "health">) {
  const facts = result.extraction.facts;

  return {
    property_address: facts.property_address,
    buyer_names: facts.buyer_names,
    seller_names: facts.seller_names,
    closing_date: toIsoDate(facts.closing_date),
    purchase_price: facts.purchase_price,
    financing_type: facts.financing_type,
    packet_status: statusFromHealth(result.health.packetStatus),
    updated_at: new Date().toISOString(),
  };
}

type ExistingFlagRow = {
  category: string;
  title: string;
  source_page: number | null;
  required_document: string | null;
  status: string;
};

async function deleteExistingPacketData(supabase: ReturnType<typeof createAdminClient>, transactionId: string) {
  const tables = ["deadlines", "packet_flags", "rule_results", "extracted_transaction_fields", "documents"] as const;

  for (const table of tables) {
    const { error } = await withSchemaCacheRetry(() =>
      supabase.from(table).delete().eq("transaction_id", transactionId),
    );
    if (error) {
      throw asDataAccessError(error, `Could not clear existing ${table}.`);
    }
  }
}

function flagKey(category: string, title: string, sourcePage: number | null, requiredDocument: string | null) {
  return `${category}|${title}|${sourcePage ?? ""}|${requiredDocument ?? ""}`;
}

function averageDocumentConfidence(documents: ExtractionPipelineResult["extraction"]["documents"]) {
  if (documents.length === 0) {
    return 0;
  }
  return documents.reduce((total, document) => total + document.confidence, 0) / documents.length;
}

function statusFromHealth(status: ExtractionPipelineResult["health"]["packetStatus"]): PacketStatus {
  if (status === "processing_error") {
    return "error";
  }
  return status;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function asDataAccessError(error: { code?: string | null; message?: string }, fallbackMessage: string): DataAccessError {
  return new DataAccessError(error.message || fallbackMessage, { code: error.code ?? undefined });
}
