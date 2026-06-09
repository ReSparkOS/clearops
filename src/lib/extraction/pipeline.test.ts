import { describe, expect, it } from "vitest";
import {
  packetExtractionSchema,
  runExtractionPipeline,
} from "./pipeline";

describe("packetExtractionSchema", () => {
  it("accepts strict document classifications and packet facts", () => {
    const parsed = packetExtractionSchema.parse({
      schemaVersion: "2026-06-09",
      rawTextSummary: "Residential contract packet for a Missouri purchase.",
      documents: [
        {
          id: "doc-1",
          filename: "packet.pdf",
          documentType: "residential_sale_contract",
          confidence: 0.93,
          pageStart: 1,
          pageEnd: 11,
        },
      ],
      facts: {
        property_address: "412 Maple Ridge Dr, Columbia, MO",
        buyer_names: ["Avery Buyer"],
        seller_names: ["Sam Seller"],
        purchase_price: 325000,
        closing_date: "2026-07-15",
        financing_type: "conventional",
        cash_or_financed: "financed",
        referenced_documents: [],
        signatures_detected: "needs_review",
        initials_detected: "likely_complete",
      },
    });

    expect(parsed.documents[0].documentType).toBe("residential_sale_contract");
    expect(parsed.facts.cash_or_financed).toBe("financed");
  });

  it("rejects unsupported document types instead of silently accepting freestyle labels", () => {
    expect(() =>
      packetExtractionSchema.parse({
        schemaVersion: "2026-06-09",
        rawTextSummary: "Bad payload",
        documents: [
          {
            id: "doc-1",
            filename: "packet.pdf",
            documentType: "random_legal_thing",
            confidence: 0.93,
          },
        ],
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
      }),
    ).toThrow();
  });
});

describe("runExtractionPipeline", () => {
  it("returns a failed extraction (never fabricated demo data) when OpenAI is not configured", async () => {
    const result = await runExtractionPipeline({
      apiKey: "",
      filename: "packet.pdf",
      fileBuffer: Buffer.from("placeholder"),
    });

    expect(result.mode).toBe("failed");
    expect(result.error).toBeTruthy();
    expect(result.extraction.documents).toEqual([]);
    expect(result.extraction.facts.property_address).toBeNull();
    expect(result.extraction.facts.buyer_names).toEqual([]);
    expect(result.health.flags).toEqual([]);
    expect(result.health.packetStatus).toBe("processing_error");
  });
});
