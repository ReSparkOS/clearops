import { describe, expect, it } from "vitest";
import { runMissouriResidentialRules } from "./missouri";
import type { PacketFacts, PacketDocument } from "@/lib/domain/types";

const contract: PacketDocument = {
  id: "doc-contract",
  filename: "contract.pdf",
  documentType: "residential_sale_contract",
  confidence: 0.94,
  pageStart: 1,
  pageEnd: 12,
};

function runRules(
  facts: Partial<PacketFacts>,
  documents: PacketDocument[] = [contract],
) {
  return runMissouriResidentialRules({
    asOf: new Date("2026-06-09T12:00:00-05:00"),
    documents,
    facts: {
      property_address: "412 Maple Ridge Dr, Columbia, MO",
      buyer_names: ["Avery Buyer"],
      seller_names: ["Sam Seller"],
      purchase_price: 325000,
      closing_date: "2026-07-15",
      financing_type: "conventional",
      cash_or_financed: "financed",
      referenced_documents: [],
      signatures_detected: "likely_complete",
      initials_detected: "likely_complete",
      ...facts,
    },
  });
}

describe("runMissouriResidentialRules", () => {
  it("requires a lead-based paint disclosure when a Missouri residential property predates 1978", () => {
    const result = runRules({ property_year_built: 1965 });

    expect(result.flags).toContainEqual(
      expect.objectContaining({
        category: "missing_doc",
        severity: "high",
        title: "Lead-based paint disclosure likely required",
        requiredDocument: "lead_based_paint_disclosure",
        status: "needs_follow_up",
      }),
    );
    expect(result.packetStatus).toBe("high_risk");
  });

  it("flags uncertainty when year built is unavailable", () => {
    const result = runRules({ property_year_built: null });

    expect(result.flags).toContainEqual(
      expect.objectContaining({
        category: "unclear_terms",
        severity: "medium",
        title: "Lead-based paint requirement unknown",
      }),
    );
  });

  it("requires financing support when the contract is financed", () => {
    const result = runRules({
      financing_type: "FHA",
      cash_or_financed: "financed",
    });

    expect(result.flags).toContainEqual(
      expect.objectContaining({
        category: "missing_doc",
        severity: "high",
        title: "Financing documentation missing or unclear",
        requiredDocument: "fha_addendum",
      }),
    );
  });

  it("requires proof of funds for cash purchases", () => {
    const result = runRules({
      financing_type: "cash",
      cash_or_financed: "cash",
    });

    expect(result.flags).toContainEqual(
      expect.objectContaining({
        category: "missing_doc",
        severity: "medium",
        title: "Proof of funds not found",
        requiredDocument: "cash_proof_of_funds",
      }),
    );
  });

  it("flags referenced attachments that are not found in the packet", () => {
    const result = runRules({
      referenced_documents: [
        {
          label: "Exhibit A",
          sourceDocumentId: "doc-contract",
          sourcePage: 8,
          confidence: 0.88,
        },
        {
          label: "Inspection Resolution",
          sourceDocumentId: "doc-contract",
          sourcePage: 10,
          confidence: 0.82,
        },
      ],
    });

    expect(result.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "missing_doc",
          title: "Referenced document not found: Exhibit A",
          sourcePage: 8,
        }),
        expect.objectContaining({
          category: "missing_doc",
          title: "Referenced document not found: Inspection Resolution",
          sourcePage: 10,
        }),
      ]),
    );
  });

  it("marks later amendment terms as controlling while requiring human review", () => {
    const result = runRules(
      {
        purchase_price: 325000,
        closing_date: "2026-07-15",
        amendment_changes: [
          {
            field: "purchase_price",
            originalValue: "325000",
            newValue: "330000",
            controllingDocumentId: "doc-amendment",
            sourcePage: 2,
            confidence: 0.91,
          },
        ],
      },
      [
        contract,
        {
          id: "doc-amendment",
          filename: "amendment-1.pdf",
          documentType: "amendment",
          confidence: 0.9,
          pageStart: 13,
          pageEnd: 14,
        },
      ],
    );

    expect(result.amendmentChanges).toContainEqual(
      expect.objectContaining({
        field: "purchase_price",
        controllingDocumentId: "doc-amendment",
        needsHumanReview: true,
      }),
    );
    expect(result.flags).toContainEqual(
      expect.objectContaining({
        category: "conflicting_terms",
        title: "Amendment changes purchase price",
      }),
    );
  });

  it("flags expired and ambiguous deadlines", () => {
    const result = runRules({
      deadlines: [
        {
          name: "Inspection objection deadline",
          date: "2026-06-01",
          sourceDocumentId: "doc-contract",
          sourcePage: 5,
          confidence: 0.86,
        },
        {
          name: "Title objection deadline",
          date: null,
          sourceDocumentId: "doc-contract",
          sourcePage: 7,
          confidence: 0.43,
        },
      ],
    });

    expect(result.deadlines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Inspection objection deadline", riskStatus: "expired" }),
        expect.objectContaining({ name: "Title objection deadline", riskStatus: "ambiguous" }),
      ]),
    );
    expect(result.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "deadline_risk", severity: "high" }),
        expect.objectContaining({ category: "deadline_risk", severity: "medium" }),
      ]),
    );
  });

  it("flags unknown documents for manual review", () => {
    const result = runRules(
      {},
      [
        contract,
        {
          id: "doc-unknown",
          filename: "mystery.pdf",
          documentType: "unknown_document",
          confidence: 0.38,
          pageStart: 15,
          pageEnd: 16,
        },
      ],
    );

    expect(result.flags).toContainEqual(
      expect.objectContaining({
        category: "unknown_doc",
        severity: "low",
        title: "Unknown document needs review",
      }),
    );
  });
});
