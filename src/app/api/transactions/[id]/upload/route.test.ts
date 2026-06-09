import { beforeEach, describe, expect, it, vi } from "vitest";
import { persistExtractionResult } from "@/lib/db/persistence";
import { runExtractionPipeline, type ExtractionPipelineResult } from "@/lib/extraction/pipeline";
import { POST } from "./route";

vi.mock("@/lib/storage/documents", () => ({
  storePacketDocument: vi.fn(async () => {
    throw new Error("Supabase Storage upload failed: Bucket not found");
  }),
}));

vi.mock("@/lib/db/persistence", () => ({
  persistExtractionResult: vi.fn(async () => ({ status: "saved", documentCount: 1 })),
}));

vi.mock("@/lib/extraction/pipeline", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/extraction/pipeline")>()),
  runExtractionPipeline: vi.fn(async () => openaiResult("contract.pdf", "doc-1", "residential_sale_contract")),
}));

const VALID_PDF = "%PDF-1.4 fake but valid header";

describe("upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runExtractionPipeline).mockResolvedValue(openaiResult("contract.pdf", "doc-1", "residential_sale_contract"));
  });

  it("rejects files that are not real PDFs (magic-byte check)", async () => {
    const formData = new FormData();
    formData.append("files", new File(["not a pdf"], "contract.pdf", { type: "application/pdf" }));
    const response = await POST(request(formData), { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("not a valid PDF");
  });

  it("processes a valid PDF and warns (not fails) when storage is unavailable", async () => {
    const formData = new FormData();
    formData.append("files", new File([VALID_PDF], "contract.pdf", { type: "application/pdf" }));
    const response = await POST(request(formData), { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    const payload = await response.json();

    expect(response.status, JSON.stringify(payload)).toBe(200);
    expect(payload.processed).toBe(1);
    expect(payload.status).toBe("saved");
    expect(payload.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Could not store contract.pdf")]),
    );
    expect(persistExtractionResult).toHaveBeenCalledTimes(1);
  });

  it("combines multiple uploaded PDFs into one persisted packet", async () => {
    vi.mocked(runExtractionPipeline)
      .mockResolvedValueOnce(openaiResult("offer.pdf", "doc-offer", "residential_sale_contract"))
      .mockResolvedValueOnce(openaiResult("achosa.pdf", "doc-achosa", "home_warranty_addendum"));

    const formData = new FormData();
    formData.append("files", new File([VALID_PDF], "offer.pdf", { type: "application/pdf" }));
    formData.append("files", new File([VALID_PDF], "achosa.pdf", { type: "application/pdf" }));
    const response = await POST(request(formData), { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    const payload = await response.json();

    expect(response.status, JSON.stringify(payload)).toBe(200);
    expect(payload.processed).toBe(2);
    expect(persistExtractionResult).toHaveBeenCalledTimes(1);
    expect(vi.mocked(persistExtractionResult).mock.calls[0]?.[0].result.extraction.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ filename: "offer.pdf", documentType: "residential_sale_contract" }),
        expect.objectContaining({ filename: "achosa.pdf", documentType: "home_warranty_addendum" }),
      ]),
    );
  });
});

function request(formData: FormData) {
  return new Request("http://localhost/api/transactions/x/upload", { method: "POST", body: formData });
}

function openaiResult(filename: string, id: string, documentType: string): ExtractionPipelineResult {
  return {
    mode: "openai",
    extraction: {
      schemaVersion: "1.0",
      rawTextSummary: `Extracted ${filename}.`,
      documents: [{ id, filename, documentType, confidence: 0.9, pageStart: 1, pageEnd: 1 }],
      facts: {
        property_address: filename === "achosa.pdf" ? null : "3526 East Farm Road 88, Springfield, MO 65803",
        buyer_names: filename === "achosa.pdf" ? [] : ["Buyer One"],
        seller_names: filename === "achosa.pdf" ? [] : ["Seller One"],
        purchase_price: filename === "achosa.pdf" ? null : 275000,
        closing_date: filename === "achosa.pdf" ? null : "2026-07-15",
        financing_type: filename === "achosa.pdf" ? null : "conventional",
        cash_or_financed: filename === "achosa.pdf" ? "unknown" : "financed",
        referenced_documents: [],
        signatures_detected: "unknown",
        initials_detected: "unknown",
      },
    },
    health: { packetStatus: "needs_review", flags: [], deadlines: [], amendmentChanges: [] },
    rawResponse: null,
    extractedText: `Text from ${filename}`,
  } as ExtractionPipelineResult;
}
