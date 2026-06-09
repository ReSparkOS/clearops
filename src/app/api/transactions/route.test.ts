import { describe, expect, it, vi } from "vitest";
import { getApiOrgContext } from "@/lib/auth/session";
import { createTransactionRecord } from "@/lib/db/transactions";
import { POST } from "./route";

vi.mock("@/lib/db/transactions", () => ({
  createTransactionRecord: vi.fn(async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    status: "not_uploaded",
  })),
  listTransactionsForDashboard: vi.fn(async () => []),
}));

vi.mock("@/lib/auth/session", () => ({
  getApiOrgContext: vi.fn(async () => ({
    user: { id: "33333333-3333-4333-8333-333333333333" },
    organizationId: "22222222-2222-4222-8222-222222222222",
    role: "owner",
  })),
}));

vi.mock("@/lib/db/audit", () => ({
  recordAuditEvent: vi.fn(async () => {}),
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
      "22222222-2222-4222-8222-222222222222",
    );
    expect(payload).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      mode: "supabase",
      status: "not_uploaded",
    });
  });

  it("scopes the created transaction to the caller's organization", async () => {
    await POST(
      new Request("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({ propertyAddress: "1 Test St" }),
      }),
    );

    expect(createTransactionRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({ propertyAddress: "1 Test St" }),
      "22222222-2222-4222-8222-222222222222",
    );
  });

  it("rejects unauthenticated requests with 401", async () => {
    vi.mocked(getApiOrgContext).mockResolvedValueOnce(null);

    const response = await POST(
      new Request("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({ propertyAddress: "1 Test St" }),
      }),
    );

    expect(response.status).toBe(401);
  });
});
