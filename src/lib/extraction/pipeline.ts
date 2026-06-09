import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { PacketDocument, PacketFacts, RuleEngineResult } from "@/lib/domain/types";
import { runMissouriResidentialRules } from "@/lib/rules/missouri";

const documentTypeValues = [
  "residential_sale_contract",
  "counteroffer",
  "amendment",
  "inspection_notice",
  "inspection_resolution",
  "buyer_agency_agreement",
  "listing_agreement",
  "seller_disclosure",
  "lead_based_paint_disclosure",
  "earnest_money_receipt",
  "financing_addendum",
  "appraisal_addendum",
  "fha_addendum",
  "va_addendum",
  "usda_addendum",
  "conventional_financing_document",
  "cash_proof_of_funds",
  "hoa_condo_documents",
  "septic_well_private_water_disclosure",
  "personal_property_addendum",
  "home_warranty_addendum",
  "wire_fraud_notice",
  "closing_instructions",
  "title_document",
  "unknown_document",
] as const;

const confidenceStatusValues = ["likely_complete", "needs_review", "missing", "unknown"] as const;

export const packetDocumentSchema = z.object({
  id: z.string().min(1),
  filename: z.string().min(1),
  documentType: z.enum(documentTypeValues),
  confidence: z.number().min(0).max(1),
  pageStart: z.number().int().positive().nullable().optional(),
  pageEnd: z.number().int().positive().nullable().optional(),
});

// Strict variants (no .optional()) shared by the OpenAI and Anthropic structured-output APIs,
// which require every schema property to be present.
const strictPacketDocumentSchema = z.object({
  id: z.string().min(1),
  filename: z.string().min(1),
  documentType: z.enum(documentTypeValues),
  confidence: z.number().min(0).max(1),
  pageStart: z.number().int().positive().nullable(),
  pageEnd: z.number().int().positive().nullable(),
});

const referencedDocumentSchema = z.object({
  label: z.string().min(1),
  sourceDocumentId: z.string().nullable().optional(),
  sourcePage: z.number().int().positive().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

const strictReferencedDocumentSchema = z.object({
  label: z.string().min(1),
  sourceDocumentId: z.string().nullable(),
  sourcePage: z.number().int().positive().nullable(),
  confidence: z.number().min(0).max(1),
});

const extractedDeadlineSchema = z.object({
  name: z.string().min(1),
  date: z.string().nullable(),
  sourceDocumentId: z.string().nullable().optional(),
  sourcePage: z.number().int().positive().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

const strictExtractedDeadlineSchema = z.object({
  name: z.string().min(1),
  date: z.string().nullable(),
  sourceDocumentId: z.string().nullable(),
  sourcePage: z.number().int().positive().nullable(),
  confidence: z.number().min(0).max(1),
});

const amendmentChangeSchema = z.object({
  field: z.string().min(1),
  originalValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  newValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  controllingDocumentId: z.string().min(1),
  sourcePage: z.number().int().positive().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

const strictAmendmentChangeSchema = z.object({
  field: z.string().min(1),
  originalValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  newValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  controllingDocumentId: z.string().min(1),
  sourcePage: z.number().int().positive().nullable(),
  confidence: z.number().min(0).max(1),
});

export const packetFactsSchema = z.object({
  property_address: z.string().nullable(),
  buyer_names: z.array(z.string()),
  seller_names: z.array(z.string()),
  listing_agent: z.string().nullable().optional(),
  buyer_agent: z.string().nullable().optional(),
  brokerage_names: z.array(z.string()).optional(),
  purchase_price: z.number().nullable(),
  earnest_money_amount: z.number().nullable().optional(),
  earnest_money_due_date: z.string().nullable().optional(),
  closing_date: z.string().nullable(),
  possession_terms: z.string().nullable().optional(),
  financing_type: z.string().nullable(),
  loan_amount: z.number().nullable().optional(),
  cash_or_financed: z.enum(["cash", "financed", "unknown"]),
  appraisal_contingency: z.boolean().nullable().optional(),
  inspection_deadline: z.string().nullable().optional(),
  inspection_resolution_deadline: z.string().nullable().optional(),
  title_objection_deadline: z.string().nullable().optional(),
  home_warranty_terms: z.string().nullable().optional(),
  seller_concessions: z.union([z.string(), z.number(), z.null()]).optional(),
  personal_property_included: z.string().nullable().optional(),
  property_year_built: z.number().int().nullable().optional(),
  lead_based_paint_required: z.boolean().nullable().optional(),
  hoa_or_condo: z.boolean().nullable().optional(),
  septic_or_well: z.boolean().nullable().optional(),
  amendments_present: z.boolean().nullable().optional(),
  counteroffers_present: z.boolean().nullable().optional(),
  referenced_documents: z.array(referencedDocumentSchema),
  missing_referenced_documents: z.array(referencedDocumentSchema).optional(),
  signatures_detected: z.enum(confidenceStatusValues),
  initials_detected: z.enum(confidenceStatusValues),
  signature_issues: z.array(z.string()).optional(),
  date_issues: z.array(z.string()).optional(),
  conflicting_terms: z.array(z.string()).optional(),
  special_agreements: z.array(z.string()).optional(),
  risk_flags: z.array(z.string()).optional(),
  deadlines: z.array(extractedDeadlineSchema).optional(),
  amendment_changes: z.array(amendmentChangeSchema).optional(),
});

export const packetExtractionSchema = z.object({
  schemaVersion: z.string(),
  rawTextSummary: z.string(),
  documents: z.array(packetDocumentSchema),
  facts: packetFactsSchema,
});

const strictPacketFactsSchema = z.object({
  property_address: z.string().nullable(),
  buyer_names: z.array(z.string()),
  seller_names: z.array(z.string()),
  listing_agent: z.string().nullable(),
  buyer_agent: z.string().nullable(),
  brokerage_names: z.array(z.string()),
  purchase_price: z.number().nullable(),
  earnest_money_amount: z.number().nullable(),
  earnest_money_due_date: z.string().nullable(),
  closing_date: z.string().nullable(),
  possession_terms: z.string().nullable(),
  financing_type: z.string().nullable(),
  loan_amount: z.number().nullable(),
  cash_or_financed: z.enum(["cash", "financed", "unknown"]),
  appraisal_contingency: z.boolean().nullable(),
  inspection_deadline: z.string().nullable(),
  inspection_resolution_deadline: z.string().nullable(),
  title_objection_deadline: z.string().nullable(),
  home_warranty_terms: z.string().nullable(),
  seller_concessions: z.union([z.string(), z.number(), z.null()]),
  personal_property_included: z.string().nullable(),
  property_year_built: z.number().int().nullable(),
  lead_based_paint_required: z.boolean().nullable(),
  hoa_or_condo: z.boolean().nullable(),
  septic_or_well: z.boolean().nullable(),
  amendments_present: z.boolean().nullable(),
  counteroffers_present: z.boolean().nullable(),
  referenced_documents: z.array(strictReferencedDocumentSchema),
  missing_referenced_documents: z.array(strictReferencedDocumentSchema),
  signatures_detected: z.enum(confidenceStatusValues),
  initials_detected: z.enum(confidenceStatusValues),
  signature_issues: z.array(z.string()),
  date_issues: z.array(z.string()),
  conflicting_terms: z.array(z.string()),
  special_agreements: z.array(z.string()),
  risk_flags: z.array(z.string()),
  deadlines: z.array(strictExtractedDeadlineSchema),
  amendment_changes: z.array(strictAmendmentChangeSchema),
});

const strictPacketExtractionSchema = z.object({
  schemaVersion: z.string(),
  rawTextSummary: z.string(),
  documents: z.array(strictPacketDocumentSchema),
  facts: strictPacketFactsSchema,
});

export type PacketExtraction = z.infer<typeof packetExtractionSchema>;

export type ExtractionProvider = "openai" | "anthropic";

const PROVIDER_DEFAULTS: Record<ExtractionProvider, { label: string; envKey: string; defaultModel: string }> = {
  openai: { label: "OpenAI", envKey: "OPENAI_API_KEY", defaultModel: "gpt-5.5" },
  anthropic: { label: "Anthropic", envKey: "ANTHROPIC_API_KEY", defaultModel: "claude-fable-5" },
};

export function resolveExtractionProvider(value?: string | null): ExtractionProvider {
  const candidate = value ?? process.env.EXTRACTION_PROVIDER;
  return candidate === "anthropic" ? "anthropic" : "openai";
}

function defaultModelFor(provider: ExtractionProvider) {
  const envModel = provider === "anthropic" ? process.env.ANTHROPIC_MODEL : process.env.OPENAI_MODEL;
  return envModel ?? PROVIDER_DEFAULTS[provider].defaultModel;
}

export type ExtractionPipelineInput = {
  apiKey?: string;
  fileBuffer: Buffer;
  filename: string;
  model?: string;
  provider?: ExtractionProvider;
};

export type ExtractionPipelineResult = {
  mode: ExtractionProvider | "failed";
  extraction: PacketExtraction;
  health: RuleEngineResult;
  rawResponse: unknown | null;
  extractedText: string | null;
  error?: string;
};

export async function runExtractionPipeline(input: ExtractionPipelineInput): Promise<ExtractionPipelineResult> {
  const provider = resolveExtractionProvider(input.provider);
  const apiKey = input.apiKey ?? process.env[PROVIDER_DEFAULTS[provider].envKey] ?? "";
  const model = input.model ?? defaultModelFor(provider);

  if (!apiKey) {
    return buildFailedResult(
      input.filename,
      `${PROVIDER_DEFAULTS[provider].label} API key is not configured, so the packet could not be extracted.`,
      null,
    );
  }

  let extractedText: string;
  try {
    extractedText = await extractTextFromPdf(input.fileBuffer);
  } catch (error) {
    return buildFailedResult(
      input.filename,
      `PDF text extraction failed: ${error instanceof Error ? error.message : "unknown error"}`,
      null,
    );
  }

  if (extractedText.trim().length < 50) {
    return buildFailedResult(
      input.filename,
      "This PDF has little or no extractable text (it may be a scan or image-only file). Run OCR or upload a text-based PDF.",
      extractedText,
    );
  }

  try {
    const { output, rawResponse } =
      provider === "anthropic"
        ? await extractWithAnthropic({ apiKey, model, filename: input.filename, extractedText })
        : await extractWithOpenAi({ apiKey, model, filename: input.filename, extractedText });

    const parsed = packetExtractionSchema.parse(strictPacketExtractionSchema.parse(output));
    return buildPipelineResult(parsed, provider, rawResponse, extractedText);
  } catch (error) {
    return buildFailedResult(
      input.filename,
      `AI extraction failed: ${error instanceof Error ? error.message : "unknown error"}`,
      extractedText,
    );
  }
}

const EXTRACTION_SYSTEM_PROMPT =
  "You classify and extract Missouri residential real estate packet facts. Return strict JSON only through the provided schema. Do not make legal compliance conclusions.";

type ProviderCallInput = { apiKey: string; model: string; filename: string; extractedText: string };

async function extractWithOpenAi({ apiKey, model, filename, extractedText }: ProviderCallInput) {
  const client = new OpenAI({ apiKey });
  const response = await client.responses.parse({
    model,
    input: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: buildExtractionPrompt(filename, extractedText) },
    ],
    text: {
      format: zodTextFormat(strictPacketExtractionSchema, "packet_extraction"),
    },
  });

  return { output: response.output_parsed, rawResponse: response as unknown };
}

// Claude's grammar-enforced structured outputs cap union-typed parameters at 16, and this
// extraction schema legitimately needs ~31 nullable fields ("not found in packet" is a core
// domain state). So for Anthropic we embed the JSON Schema in the prompt and enforce
// conformance locally: the response must pass the same strict zod schema or the extraction
// fails closed — exactly like every other failure path in this pipeline.
async function extractWithAnthropic({ apiKey, model, filename, extractedText }: ProviderCallInput) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    // Generous for this schema (extraction JSON is typically a few thousand tokens) while staying
    // under the SDK's non-streaming 10-minute ceiling. Includes headroom for adaptive thinking.
    max_tokens: 16_000,
    system: [
      EXTRACTION_SYSTEM_PROMPT,
      "Respond with ONLY a single JSON object that conforms exactly to this JSON Schema — no prose, no markdown fences:",
      JSON.stringify(z.toJSONSchema(strictPacketExtractionSchema)),
    ].join("\n\n"),
    messages: [{ role: "user", content: buildExtractionPrompt(filename, extractedText) }],
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("Claude response was truncated before the extraction JSON completed.");
  }

  const text = response.content
    .filter((block): block is Extract<(typeof response.content)[number], { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("");

  return { output: parseJsonObject(text), rawResponse: response as unknown };
}

function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Claude returned no JSON object (the request may have been refused).");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function extractTextFromPdf(fileBuffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });

  try {
    const result = await parser.getText({
      pageJoiner: "\n\n--- PAGE page_number of total_number ---\n\n",
    });
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export function emptyExtraction(filename = "packet.pdf"): PacketExtraction {
  return packetExtractionSchema.parse({
    schemaVersion: "failed",
    rawTextSummary: `No structured data could be extracted from ${filename}.`,
    documents: [],
    facts: {
      property_address: null,
      buyer_names: [],
      seller_names: [],
      purchase_price: null,
      closing_date: null,
      financing_type: null,
      cash_or_financed: "unknown",
      referenced_documents: [],
      signatures_detected: "unknown",
      initials_detected: "unknown",
    },
  });
}

function buildPipelineResult(
  extraction: PacketExtraction,
  mode: ExtractionPipelineResult["mode"],
  rawResponse: unknown | null,
  extractedText: string | null,
  error?: string,
): ExtractionPipelineResult {
  return {
    mode,
    extraction,
    health: runMissouriResidentialRules({
      asOf: new Date(),
      documents: extraction.documents as PacketDocument[],
      facts: extraction.facts as PacketFacts,
    }),
    rawResponse,
    extractedText,
    error,
  };
}

// A failed extraction never fabricates packet facts. It returns an empty extraction and an
// explicit processing_error health so the UI can show "extraction failed" instead of fake data.
function buildFailedResult(
  filename: string,
  error: string,
  extractedText: string | null,
): ExtractionPipelineResult {
  return {
    mode: "failed",
    extraction: emptyExtraction(filename),
    health: {
      packetStatus: "processing_error",
      flags: [],
      deadlines: [],
      amendmentChanges: [],
    },
    rawResponse: null,
    extractedText,
    error,
  };
}

function buildExtractionPrompt(filename: string, text: string) {
  return [
    `Filename: ${filename}`,
    "",
    "Classify each document in the packet, extract transaction facts, identify referenced attachments/addenda/exhibits/disclosures/notices, and include confidence scores plus source pages where possible.",
    "Use unknown_document when classification confidence is low. Use needs_review, missing, or unknown for signatures/initials unless clearly complete.",
    "",
    "Packet text with page markers:",
    text.slice(0, 120_000),
  ].join("\n");
}
