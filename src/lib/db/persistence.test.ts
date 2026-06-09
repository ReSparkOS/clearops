import { describe, expect, it } from "vitest";
import { emptyExtraction, type ExtractionPipelineResult } from "@/lib/extraction/pipeline";
import { persistExtractionResult, transactionUpdateFromExtraction } from "./persistence";

describe("transactionUpdateFromExtraction", () => {
  it("maps extracted facts, normalizes dates, and keeps the real high_risk status", () => {
    const update = transactionUpdateFromExtraction({
      extraction: {
        schemaVersion: "1.0",
        rawTextSummary: "summary",
        documents: [],
        facts: {
          property_address: "1 Alpha St, Columbia, MO",
          buyer_names: ["Blair Buyer"],
          seller_names: ["Sawyer Seller"],
          purchase_price: 300000,
          closing_date: "June 30, 2026",
          financing_type: "conventional",
          cash_or_financed: "financed",
          referenced_documents: [],
          signatures_detected: "unknown",
          initials_detected: "unknown",
        },
      },
      health: { packetStatus: "high_risk", flags: [], deadlines: [], amendmentChanges: [] },
    });

    expect(update).toMatchObject({
      property_address: "1 Alpha St, Columbia, MO",
      buyer_names: ["Blair Buyer"],
      closing_date: "2026-06-30",
      packet_status: "high_risk",
    });
  });
});

describe("persistExtractionResult", () => {
  it("rejects non-UUID transaction ids instead of writing fabricated data", async () => {
    const failed: ExtractionPipelineResult = {
      mode: "failed",
      extraction: emptyExtraction("packet.pdf"),
      health: { packetStatus: "processing_error", flags: [], deadlines: [], amendmentChanges: [] },
      rawResponse: null,
      extractedText: null,
      error: "extraction failed",
    };

    await expect(persistExtractionResult({ transactionId: "not-a-uuid", result: failed })).rejects.toThrow(
      /Unknown transaction id/,
    );
  });
});
