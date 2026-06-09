import { describe, expect, it, vi } from "vitest";
import { createTransactionRecord } from "@/lib/db/transactions";
import { POST } from "./route";

vi.mock("@/lib/db/transactions", () => ({
  createTransactionRecord: vi.fn(async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    status: "not_uploaded",
  })),
  listTransactionsForDashboard: vi.fn(async () => []),
}));

describe("transactions route", () => {
  it("creates a Supabase-backed transaction when persistence is configured", async () => {
    const response = await POST(
      new Request("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          propertyAddress: "919 Beta Test Ave, Columbia, MO",
          buyerNames: ["Blair Buyer"],
          sellerNames: ["Sawyer Seller"],
          purchasePrice: 410000,
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(createTransactionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyAddress: "919 Beta Test Ave, Columbia, MO",
        buyerNames: ["Blair Buyer"],
        sellerNames: ["Sawyer Seller"],
      }),
    );
    expect(payload).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      mode: "supabase",
      status: "not_uploaded",
    });
  });
});
