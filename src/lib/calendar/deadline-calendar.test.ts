import { describe, expect, it } from "vitest";
import type { TransactionRecord } from "@/lib/domain/types";
import { buildContractCalendar } from "./deadline-calendar";

describe("buildContractCalendar", () => {
  it("builds a month grid and upcoming agenda from transaction deadlines", () => {
    const calendar = buildContractCalendar(
      [
        transactionRecord({
          id: "txn-1",
          propertyAddress: "3526 W Farm Rd 88",
          deadlines: [
            deadline("Inspection objection", "2026-06-12", "due_soon", 3),
            deadline("Closing", "2026-06-25", "open", 11),
          ],
        }),
        transactionRecord({
          id: "txn-2",
          propertyAddress: "88 Oak Hollow Ct",
          deadlines: [deadline("Title objection", "2026-06-18", "expired", 7)],
        }),
      ],
      new Date("2026-06-09T12:00:00-05:00"),
    );

    expect(calendar.monthLabel).toBe("June 2026");
    expect(calendar.totalEventCount).toBe(3);
    expect(calendar.riskCounts).toMatchObject({ expired: 1, dueSoon: 1, open: 1, ambiguous: 0 });
    expect(calendar.upcoming.map((event) => event.name)).toEqual([
      "Inspection objection",
      "Title objection",
      "Closing",
    ]);
    expect(calendar.upcoming[0]).toMatchObject({
      transactionId: "txn-1",
      propertyAddress: "3526 W Farm Rd 88",
      dayLabel: "Jun 12",
      sourcePage: 3,
    });
    expect(calendar.weeks).toHaveLength(5);
    expect(calendar.weeks.flat().find((day) => day.dateKey === "2026-06-12")?.events).toHaveLength(1);
  });

  it("keeps undated deadlines visible without putting them on the grid", () => {
    const calendar = buildContractCalendar(
      [
        transactionRecord({
          id: "txn-1",
          propertyAddress: "3526 W Farm Rd 88",
          deadlines: [
            deadline("Earnest money due", null, "ambiguous", 4),
            deadline("Closing", "2026-06-25", "open", 11),
          ],
        }),
      ],
      new Date("2026-06-09T12:00:00-05:00"),
    );

    expect(calendar.totalEventCount).toBe(2);
    expect(calendar.undated).toEqual([
      expect.objectContaining({
        name: "Earnest money due",
        dateLabel: "Needs review",
        riskStatus: "ambiguous",
      }),
    ]);
    expect(calendar.weeks.flat().flatMap((day) => day.events).map((event) => event.name)).toEqual(["Closing"]);
  });
});

function deadline(
  name: string,
  date: string | null,
  riskStatus: TransactionRecord["health"]["deadlines"][number]["riskStatus"],
  sourcePage: number,
): TransactionRecord["health"]["deadlines"][number] {
  return {
    name,
    date,
    riskStatus,
    sourcePage,
    confidence: 0.9,
  };
}

function transactionRecord(input: {
  id: string;
  propertyAddress: string;
  deadlines: TransactionRecord["health"]["deadlines"];
}): TransactionRecord {
  return {
    id: input.id,
    organizationId: "local-beta",
    propertyAddress: input.propertyAddress,
    buyerNames: ["Buyer One"],
    sellerNames: ["Seller One"],
    agentTeam: "Beta Team",
    closingDate: "2026-06-25",
    purchasePrice: 345000,
    financingType: "conventional",
    status: "needs_review",
    createdAt: "2026-06-09T12:00:00.000Z",
    updatedAt: "2026-06-09T12:00:00.000Z",
    notes: [],
    extraction: {
      schemaVersion: "1.0",
      rawTextSummary: "Test transaction.",
      documents: [],
      facts: {
        property_address: input.propertyAddress,
        buyer_names: ["Buyer One"],
        seller_names: ["Seller One"],
        purchase_price: 345000,
        closing_date: "2026-06-25",
        financing_type: "conventional",
        cash_or_financed: "financed",
        referenced_documents: [],
        signatures_detected: "unknown",
        initials_detected: "unknown",
      },
    },
    health: {
      packetStatus: "needs_review",
      flags: [],
      deadlines: input.deadlines,
      amendmentChanges: [],
    },
  };
}
