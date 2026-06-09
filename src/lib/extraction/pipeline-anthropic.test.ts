import { describe, expect, it, vi } from "vitest";

vi.mock("pdf-parse", () => ({
  PDFParse: class {
    async getText() {
      return {
        text: "Residential sale contract packet with enough extractable text for AI processing. ".repeat(20),
      };
    }

    async destroy() {}
  },
}));

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: createMock,
    };
  },
}));

function claudeTextResponse(payload: unknown, stopReason = "end_turn") {
  return {
    stop_reason: stopReason,
    content: [{ type: "text", text: JSON.stringify(payload) }],
  };
}

function strictFacts(overrides: Record<string, unknown> = {}) {
  return {
    property_address: "412 Maple Ridge Dr, Columbia, MO",
    buyer_names: ["Avery Buyer"],
    seller_names: ["Sam Seller"],
    listing_agent: null,
    buyer_agent: null,
    brokerage_names: [],
    purchase_price: 325000,
    earnest_money_amount: null,
    earnest_money_due_date: null,
    closing_date: "2026-07-15",
    possession_terms: null,
    financing_type: "conventional",
    loan_amount: null,
    cash_or_financed: "financed",
    appraisal_contingency: null,
    inspection_deadline: null,
    inspection_resolution_deadline: null,
    title_objection_deadline: null,
    home_warranty_terms: null,
    seller_concessions: null,
    personal_property_included: null,
    property_year_built: null,
    lead_based_paint_required: null,
    hoa_or_condo: null,
    septic_or_well: null,
    amendments_present: null,
    counteroffers_present: null,
    referenced_documents: [],
    missing_referenced_documents: [],
    signatures_detected: "likely_complete",
    initials_detected: "likely_complete",
    signature_issues: [],
    date_issues: [],
    conflicting_terms: [],
    special_agreements: [],
    risk_flags: [],
    deadlines: [],
    amendment_changes: [],
    ...overrides,
  };
}

describe("runExtractionPipeline with the anthropic provider", () => {
  it("maps Claude JSON output into the packet extraction result", async () => {
    createMock.mockResolvedValueOnce(
      claudeTextResponse({
        schemaVersion: "2026-06-09",
        rawTextSummary: "Residential contract packet.",
        documents: [
          {
            id: "doc-1",
            filename: "contract.pdf",
            documentType: "residential_sale_contract",
            confidence: 0.95,
            pageStart: 1,
            pageEnd: 10,
          },
        ],
        facts: strictFacts(),
      }),
    );

    const { runExtractionPipeline } = await import("./pipeline");
    const result = await runExtractionPipeline({
      provider: "anthropic",
      apiKey: "test-anthropic-key",
      filename: "contract.pdf",
      fileBuffer: Buffer.from("%PDF-1.4"),
    });

    expect(result.mode).toBe("anthropic");
    expect(result.extraction.facts.property_address).toBe("412 Maple Ridge Dr, Columbia, MO");
    expect(result.extraction.documents[0].documentType).toBe("residential_sale_contract");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-fable-5",
        system: expect.stringContaining("JSON Schema"),
      }),
    );
  });

  it("returns a failed extraction when Claude returns no JSON object", async () => {
    createMock.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "I cannot process this document." }],
    });

    const { runExtractionPipeline } = await import("./pipeline");
    const result = await runExtractionPipeline({
      provider: "anthropic",
      apiKey: "test-anthropic-key",
      filename: "contract.pdf",
      fileBuffer: Buffer.from("%PDF-1.4"),
    });

    expect(result.mode).toBe("failed");
    expect(result.error).toContain("no JSON object");
    expect(result.extraction.documents).toEqual([]);
  });

  it("returns a failed extraction when the response is truncated", async () => {
    createMock.mockResolvedValueOnce(claudeTextResponse({ partial: true }, "max_tokens"));

    const { runExtractionPipeline } = await import("./pipeline");
    const result = await runExtractionPipeline({
      provider: "anthropic",
      apiKey: "test-anthropic-key",
      filename: "contract.pdf",
      fileBuffer: Buffer.from("%PDF-1.4"),
    });

    expect(result.mode).toBe("failed");
    expect(result.error).toContain("truncated");
  });

  it("returns a failed extraction when Claude JSON fails schema validation", async () => {
    createMock.mockResolvedValueOnce(
      claudeTextResponse({
        schemaVersion: "2026-06-09",
        rawTextSummary: "Bad payload",
        documents: [
          {
            id: "doc-1",
            filename: "contract.pdf",
            documentType: "freestyle_invalid_type",
            confidence: 0.95,
            pageStart: 1,
            pageEnd: 10,
          },
        ],
        facts: strictFacts(),
      }),
    );

    const { runExtractionPipeline } = await import("./pipeline");
    const result = await runExtractionPipeline({
      provider: "anthropic",
      apiKey: "test-anthropic-key",
      filename: "contract.pdf",
      fileBuffer: Buffer.from("%PDF-1.4"),
    });

    expect(result.mode).toBe("failed");
    expect(result.extraction.documents).toEqual([]);
    expect(result.health.packetStatus).toBe("processing_error");
  });

  it("returns a failed extraction with the real error when the Claude API fails", async () => {
    createMock.mockRejectedValueOnce(new Error("overloaded_error"));

    const { runExtractionPipeline } = await import("./pipeline");
    const result = await runExtractionPipeline({
      provider: "anthropic",
      apiKey: "test-anthropic-key",
      filename: "contract.pdf",
      fileBuffer: Buffer.from("%PDF-1.4"),
    });

    expect(result.mode).toBe("failed");
    expect(result.error).toContain("AI extraction failed: overloaded_error");
    expect(result.health.packetStatus).toBe("processing_error");
  });

  it("fails fast when the Anthropic API key is missing", async () => {
    const { runExtractionPipeline } = await import("./pipeline");
    const result = await runExtractionPipeline({
      provider: "anthropic",
      apiKey: "",
      filename: "contract.pdf",
      fileBuffer: Buffer.from("%PDF-1.4"),
    });

    expect(result.mode).toBe("failed");
    expect(result.error).toContain("Anthropic API key is not configured");
  });
});
