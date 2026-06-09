import { describe, expect, it } from "vitest";
import { transactionRecordFromRows } from "./transactions";

describe("transactionRecordFromRows", () => {
  it("maps stored rows, uses persisted flags, and recomputes deadlines", () => {
    const record = transactionRecordFromRows(
      {
        id: "11111111-1111-4111-8111-111111111111",
        organization_id: "22222222-2222-4222-8222-222222222222",
        property_address: "919 Beta Test Ave, Columbia, MO",
        buyer_names: ["Blair Buyer"],
        seller_names: ["Sawyer Seller"],
        agent_team: "Beta Team",
        closing_date: "2026-08-15",
        purchase_price: 410000,
        financing_type: "conventional",
        packet_status: "high_risk",
        created_at: "2026-06-09T12:00:00.000Z",
        updated_at: "2026-06-09T13:00:00.000Z",
      },
      [
        {
          id: "doc-real-contract",
          filename: "real-contract.pdf",
          document_type: "residential_sale_contract",
          classification_confidence: 0.91,
          page_start: 1,
          page_end: 12,
        },
      ],
      {
        schema_version: "2026-06-09",
        extracted_fields: {
          property_address: "919 Beta Test Ave, Columbia, MO",
          buyer_names: ["Blair Buyer"],
          seller_names: ["Sawyer Seller"],
          purchase_price: 410000,
          closing_date: "2026-08-15",
          financing_type: "conventional",
          cash_or_financed: "financed",
          inspection_deadline: "2026-06-12",
          referenced_documents: [],
          signatures_detected: "needs_review",
          initials_detected: "likely_complete",
        },
        created_at: "2026-06-09T13:00:00.000Z",
      },
      [
        {
          id: "flag-uuid-1",
          category: "signature_issue",
          severity: "medium",
          title: "Signatures need review",
          explanation: "Marked as needs_review.",
          suggested_action: "Review source pages.",
          status: "needs_follow_up",
          confidence: 0.64,
          source_page: null,
          required_document: null,
        },
      ],
      new Date("2026-06-09T12:00:00-05:00"),
    );

    expect(record.propertyAddress).toBe("919 Beta Test Ave, Columbia, MO");
    expect(record.status).toBe("high_risk");
    expect(record.extraction.documents).toHaveLength(1);
    expect(record.extraction.documents[0]).toMatchObject({
      filename: "real-contract.pdf",
      documentType: "residential_sale_contract",
      confidence: 0.91,
    });

    // Flags come from persisted rows (stable UUID id + saved review status), not recomputed.
    expect(record.health.flags).toHaveLength(1);
    expect(record.health.flags[0]).toMatchObject({ id: "flag-uuid-1", status: "needs_follow_up", severity: "medium" });

    // Deadlines are recomputed from facts at read time (inspection_deadline present).
    expect(record.health.deadlines.length).toBeGreaterThan(0);
  });
});
