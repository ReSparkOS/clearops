import type {
  FlagCategory,
  FlagSeverity,
  PacketDocument,
  PacketFacts,
  PacketFlag,
  PacketStatus,
  ReviewStatus,
  RuleEngineResult,
  TransactionRecord,
} from "@/lib/domain/types";
import { toIsoDate } from "@/lib/domain/dates";
import { DataAccessError } from "@/lib/errors";
import { packetDocumentSchema, packetFactsSchema } from "@/lib/extraction/pipeline";
import { packetStatusFromFlags, runMissouriResidentialRules } from "@/lib/rules/missouri";
import { createAdminClient, withSchemaCacheRetry } from "@/lib/supabase/server";

export type SupabaseTransactionRow = {
  id: string;
  organization_id: string;
  property_address: string | null;
  buyer_names: string[] | null;
  seller_names: string[] | null;
  agent_team: string | null;
  closing_date: string | null;
  purchase_price: number | string | null;
  financing_type: string | null;
  packet_status: string | null;
  created_at: string;
  updated_at: string;
};

export type SupabaseDocumentRow = {
  id: string;
  transaction_id?: string;
  filename: string;
  document_type: string | null;
  classification_confidence: number | string | null;
  page_start: number | null;
  page_end: number | null;
};

export type SupabaseExtractionRow = {
  transaction_id?: string;
  schema_version: string;
  extracted_fields: unknown;
  created_at: string;
};

export type SupabaseFlagRow = {
  id: string;
  transaction_id?: string;
  category: string;
  severity: string;
  title: string;
  explanation: string;
  suggested_action: string;
  status: string;
  confidence: number | string | null;
  source_page: number | null;
  required_document: string | null;
  created_at?: string;
};

export type CreateTransactionInput = {
  propertyAddress: string;
  buyerNames: string[];
  sellerNames: string[];
  agentTeam?: string | null;
  closingDate?: string | null;
  purchasePrice?: number | null;
  financingType?: string | null;
};

const TRANSACTION_COLUMNS =
  "id, organization_id, property_address, buyer_names, seller_names, agent_team, closing_date, purchase_price, financing_type, packet_status, created_at, updated_at";

export async function listTransactionsForDashboard(): Promise<TransactionRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await withSchemaCacheRetry(() =>
    supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(100),
  );

  if (error) {
    throw asDataAccessError(error, "Could not load transactions.");
  }

  if (!data?.length) {
    return [];
  }

  return hydrateTransactionRows(data as SupabaseTransactionRow[]);
}

export async function getTransactionRecord(id: string): Promise<TransactionRecord | null> {
  if (!isUuid(id)) {
    return null;
  }

  const supabase = createAdminClient();
  const { data, error } = await withSchemaCacheRetry(() =>
    supabase.from("transactions").select(TRANSACTION_COLUMNS).eq("id", id).maybeSingle(),
  );

  if (error) {
    throw asDataAccessError(error, "Could not load this transaction.");
  }

  if (!data) {
    return null;
  }

  const [record] = await hydrateTransactionRows([data as SupabaseTransactionRow]);
  return record ?? null;
}

export async function createTransactionRecord(input: CreateTransactionInput): Promise<TransactionRecord> {
  const supabase = createAdminClient();
  const organizationId = await ensureBetaOrganization(supabase);

  const { data, error } = await withSchemaCacheRetry(() =>
    supabase
      .from("transactions")
      .insert({
        organization_id: organizationId,
        property_address: input.propertyAddress,
        buyer_names: input.buyerNames,
        seller_names: input.sellerNames,
        agent_team: input.agentTeam || "Clear Close IQ",
        closing_date: toIsoDate(input.closingDate),
        purchase_price: input.purchasePrice ?? null,
        financing_type: input.financingType || null,
        packet_status: "not_uploaded",
      })
      .select(TRANSACTION_COLUMNS)
      .single(),
  );

  if (error) {
    throw asDataAccessError(error, "Could not create the transaction.");
  }

  return transactionRecordFromRows(data as SupabaseTransactionRow, [], null, []);
}

export function transactionRecordFromRows(
  row: SupabaseTransactionRow,
  documentRows: SupabaseDocumentRow[],
  extractionRow: SupabaseExtractionRow | null,
  flagRows: SupabaseFlagRow[] = [],
  asOf = new Date(),
): TransactionRecord {
  const documents = documentRows.map(documentFromRow);
  const facts = factsFromRows(row, extractionRow);
  const hasExtraction = Boolean(extractionRow);
  const flags = flagRows.map(flagFromRow);

  // Deadlines and amendment changes are derived (no user state), so they are recomputed at read
  // time and stay accurate to "today". Flags carry review status, so they come from the DB.
  const derived = hasExtraction ? runMissouriResidentialRules({ asOf, documents, facts }) : null;

  const derivedStatus: PacketStatus = hasExtraction ? statusFromHealth(packetStatusFromFlags(flags)) : "not_uploaded";
  const status = normalizePacketStatus(row.packet_status, derivedStatus);

  const health: RuleEngineResult = {
    packetStatus: healthStatusFromPacketStatus(status),
    flags,
    deadlines: derived?.deadlines ?? [],
    amendmentChanges: derived?.amendmentChanges ?? [],
  };

  return {
    id: row.id,
    organizationId: row.organization_id,
    propertyAddress: facts.property_address ?? row.property_address ?? "Address needs review",
    buyerNames: facts.buyer_names.length ? facts.buyer_names : normalizeStringArray(row.buyer_names),
    sellerNames: facts.seller_names.length ? facts.seller_names : normalizeStringArray(row.seller_names),
    agentTeam: row.agent_team ?? "Clear Close IQ",
    closingDate: facts.closing_date ?? normalizeDate(row.closing_date),
    purchasePrice: facts.purchase_price ?? normalizeNumber(row.purchase_price),
    financingType: facts.financing_type ?? row.financing_type,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    notes: hasExtraction ? ["Loaded from stored extraction results."] : ["Packet not uploaded yet."],
    extraction: {
      schemaVersion: extractionRow?.schema_version ?? "not_uploaded",
      rawTextSummary: hasExtraction
        ? "Stored packet extraction loaded from Supabase."
        : "No packet extraction has been saved yet.",
      documents,
      facts,
    },
    health,
  };
}

async function hydrateTransactionRows(rows: SupabaseTransactionRow[]): Promise<TransactionRecord[]> {
  const supabase = createAdminClient();
  const ids = rows.map((row) => row.id);

  const [documentResponse, extractionResponse, flagResponse] = await Promise.all([
    withSchemaCacheRetry(() =>
      supabase
        .from("documents")
        .select("id, transaction_id, filename, document_type, classification_confidence, page_start, page_end")
        .in("transaction_id", ids)
        .order("uploaded_at", { ascending: false }),
    ),
    withSchemaCacheRetry(() =>
      supabase
        .from("extracted_transaction_fields")
        .select("transaction_id, schema_version, extracted_fields, created_at")
        .in("transaction_id", ids)
        .order("created_at", { ascending: false }),
    ),
    withSchemaCacheRetry(() =>
      supabase
        .from("packet_flags")
        .select(
          "id, transaction_id, category, severity, title, explanation, suggested_action, status, confidence, source_page, required_document, created_at",
        )
        .in("transaction_id", ids)
        .order("created_at", { ascending: true }),
    ),
  ]);

  if (documentResponse.error) {
    throw asDataAccessError(documentResponse.error, "Could not load packet documents.");
  }
  if (extractionResponse.error) {
    throw asDataAccessError(extractionResponse.error, "Could not load extracted fields.");
  }
  if (flagResponse.error) {
    throw asDataAccessError(flagResponse.error, "Could not load packet flags.");
  }

  const documentsByTransaction = groupByTransaction(documentResponse.data as SupabaseDocumentRow[] | null);
  const latestExtractionByTransaction = latestByTransaction(extractionResponse.data as SupabaseExtractionRow[] | null);
  const flagsByTransaction = groupFlagsByTransaction(flagResponse.data as SupabaseFlagRow[] | null);

  return rows.map((row) =>
    transactionRecordFromRows(
      row,
      documentsByTransaction.get(row.id) ?? [],
      latestExtractionByTransaction.get(row.id) ?? null,
      flagsByTransaction.get(row.id) ?? [],
    ),
  );
}

async function ensureBetaOrganization(supabase: ReturnType<typeof createAdminClient>) {
  const name = "Clear Close IQ";

  const existing = await withSchemaCacheRetry(() =>
    supabase.from("organizations").select("id").eq("name", name).maybeSingle(),
  );
  if (existing.error) {
    throw asDataAccessError(existing.error, "Could not look up the organization.");
  }
  if (existing.data?.id) {
    return existing.data.id as string;
  }

  const created = await withSchemaCacheRetry(() =>
    supabase.from("organizations").insert({ name }).select("id").single(),
  );
  if (created.error || !created.data) {
    throw asDataAccessError(created.error ?? { message: "Organization create returned no row." }, "Could not create the organization.");
  }
  return created.data.id as string;
}

function groupByTransaction(rows: SupabaseDocumentRow[] | null) {
  const grouped = new Map<string, SupabaseDocumentRow[]>();
  for (const row of rows ?? []) {
    if (!row.transaction_id) continue;
    grouped.set(row.transaction_id, [...(grouped.get(row.transaction_id) ?? []), row]);
  }
  return grouped;
}

function groupFlagsByTransaction(rows: SupabaseFlagRow[] | null) {
  const grouped = new Map<string, SupabaseFlagRow[]>();
  for (const row of rows ?? []) {
    if (!row.transaction_id) continue;
    grouped.set(row.transaction_id, [...(grouped.get(row.transaction_id) ?? []), row]);
  }
  return grouped;
}

function latestByTransaction(rows: SupabaseExtractionRow[] | null) {
  const grouped = new Map<string, SupabaseExtractionRow>();
  for (const row of rows ?? []) {
    if (row.transaction_id && !grouped.has(row.transaction_id)) {
      grouped.set(row.transaction_id, row);
    }
  }
  return grouped;
}

function documentFromRow(row: SupabaseDocumentRow): PacketDocument {
  const parsed = packetDocumentSchema.safeParse({
    id: row.id,
    filename: row.filename,
    documentType: row.document_type,
    confidence: normalizeNumber(row.classification_confidence) ?? 0,
    pageStart: row.page_start,
    pageEnd: row.page_end,
  });

  if (parsed.success) {
    return parsed.data;
  }

  return {
    id: row.id,
    filename: row.filename,
    documentType: "unknown_document",
    confidence: normalizeNumber(row.classification_confidence) ?? 0,
    pageStart: row.page_start,
    pageEnd: row.page_end,
  };
}

const FLAG_SEVERITIES = new Set<FlagSeverity>(["low", "medium", "high"]);
const FLAG_CATEGORIES = new Set<FlagCategory>([
  "missing_doc",
  "signature_issue",
  "date_issue",
  "deadline_risk",
  "conflicting_terms",
  "unclear_terms",
  "unknown_doc",
]);
const REVIEW_STATUSES = new Set<ReviewStatus>(["open", "resolved", "false_positive", "needs_follow_up"]);

function flagFromRow(row: SupabaseFlagRow): PacketFlag {
  return {
    id: row.id,
    severity: FLAG_SEVERITIES.has(row.severity as FlagSeverity) ? (row.severity as FlagSeverity) : "medium",
    category: FLAG_CATEGORIES.has(row.category as FlagCategory) ? (row.category as FlagCategory) : "unclear_terms",
    title: row.title,
    explanation: row.explanation,
    suggestedAction: row.suggested_action,
    status: REVIEW_STATUSES.has(row.status as ReviewStatus) ? (row.status as ReviewStatus) : "open",
    confidence: normalizeNumber(row.confidence) ?? 0,
    source: "rule",
    sourcePage: row.source_page,
    requiredDocument: (row.required_document as PacketFlag["requiredDocument"]) ?? undefined,
  };
}

function factsFromRows(row: SupabaseTransactionRow, extractionRow: SupabaseExtractionRow | null): PacketFacts {
  return packetFactsSchema.parse({
    property_address: row.property_address,
    buyer_names: normalizeStringArray(row.buyer_names),
    seller_names: normalizeStringArray(row.seller_names),
    purchase_price: normalizeNumber(row.purchase_price),
    closing_date: normalizeDate(row.closing_date),
    financing_type: row.financing_type,
    cash_or_financed: "unknown",
    referenced_documents: [],
    signatures_detected: "unknown",
    initials_detected: "unknown",
    ...(isRecord(extractionRow?.extracted_fields) ? extractionRow.extracted_fields : {}),
  });
}

function normalizeNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeDate(value: string | null | undefined) {
  return value?.split("T")[0] ?? null;
}

function normalizeStringArray(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizePacketStatus(value: string | null | undefined, fallback: PacketStatus): PacketStatus {
  const statuses = new Set<PacketStatus>(["not_uploaded", "processing", "needs_review", "cleared", "error", "high_risk"]);
  return statuses.has(value as PacketStatus) ? (value as PacketStatus) : fallback;
}

function statusFromHealth(status: RuleEngineResult["packetStatus"]): PacketStatus {
  if (status === "processing_error") return "error";
  return status;
}

function healthStatusFromPacketStatus(status: PacketStatus): RuleEngineResult["packetStatus"] {
  if (status === "error") return "processing_error";
  if (status === "high_risk") return "high_risk";
  if (status === "cleared") return "cleared";
  return "needs_review";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asDataAccessError(error: { code?: string | null; message?: string }, fallbackMessage: string): DataAccessError {
  return new DataAccessError(error.message || fallbackMessage, { code: error.code ?? undefined });
}
