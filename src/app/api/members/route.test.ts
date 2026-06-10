import { beforeEach, describe, expect, it, vi } from "vitest";
import { getApiOrgContext } from "@/lib/auth/session";
import { checkInviteRateLimit, recordAuditEvent } from "@/lib/db/audit";
import { countOrganizationMembers, inviteMemberToOrganization, listOrganizationMembers } from "@/lib/db/members";
import { DataAccessError } from "@/lib/errors";
import { GET, POST } from "./route";

const ORG_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "33333333-3333-4333-8333-333333333333";

vi.mock("@/lib/auth/session", () => ({
  getApiOrgContext: vi.fn(async () => ({
    user: { id: OWNER_ID },
    organizationId: ORG_ID,
    role: "owner",
  })),
}));

vi.mock("@/lib/db/members", () => ({
  listOrganizationMembers: vi.fn(async () => [
    {
      userId: OWNER_ID,
      email: "owner@example.com",
      fullName: null,
      role: "owner",
      status: "active",
      joinedAt: "2026-06-01T00:00:00Z",
    },
  ]),
  inviteMemberToOrganization: vi.fn(async () => ({ userId: "44444444-4444-4444-8444-444444444444" })),
  countOrganizationMembers: vi.fn(async () => 1),
}));

vi.mock("@/lib/db/audit", () => ({
  recordAuditEvent: vi.fn(async () => {}),
  checkInviteRateLimit: vi.fn(async () => null),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function inviteRequest(body: unknown) {
  return new Request("http://localhost/api/members", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("members route", () => {
  it("lists the organization's members", async () => {
    const response = await GET(new Request("http://localhost/api/members"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listOrganizationMembers).toHaveBeenCalledWith(ORG_ID);
    expect(payload.members).toHaveLength(1);
    expect(payload.members[0]).toMatchObject({ email: "owner@example.com", role: "owner" });
  });

  it("rejects an unauthenticated GET with 401", async () => {
    vi.mocked(getApiOrgContext).mockResolvedValueOnce(null);

    const response = await GET(new Request("http://localhost/api/members"));

    expect(response.status).toBe(401);
    expect(listOrganizationMembers).not.toHaveBeenCalled();
  });

  it("invites a teammate as owner and records the audit event", async () => {
    const response = await POST(inviteRequest({ email: "new@example.com", role: "member" }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(inviteMemberToOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        email: "new@example.com",
        role: "member",
        redirectTo: expect.stringContaining("/reset-password"),
      }),
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member_invited", organizationId: ORG_ID, actorId: OWNER_ID }),
    );
    expect(payload).toMatchObject({ email: "new@example.com", status: "invited" });
  });

  it("rejects invites from plain members with 403 and sends nothing", async () => {
    vi.mocked(getApiOrgContext).mockResolvedValueOnce({
      user: { id: "55555555-5555-4555-8555-555555555555" },
      organizationId: ORG_ID,
      role: "member",
    } as Awaited<ReturnType<typeof getApiOrgContext>>);

    const response = await POST(inviteRequest({ email: "new@example.com", role: "member" }));

    expect(response.status).toBe(403);
    expect(inviteMemberToOrganization).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("rejects an invalid email or role with 400 and sends nothing", async () => {
    const badEmail = await POST(inviteRequest({ email: "not-an-email", role: "member" }));
    const badRole = await POST(inviteRequest({ email: "ok@example.com", role: "owner" }));

    expect(badEmail.status).toBe(400);
    expect(badRole.status).toBe(400);
    expect(inviteMemberToOrganization).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with 400, not 500", async () => {
    const response = await POST(inviteRequest("{not valid json"));

    expect(response.status).toBe(400);
    expect(inviteMemberToOrganization).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests with 401", async () => {
    vi.mocked(getApiOrgContext).mockResolvedValueOnce(null);

    const response = await POST(inviteRequest({ email: "new@example.com", role: "member" }));

    expect(response.status).toBe(401);
    expect(inviteMemberToOrganization).not.toHaveBeenCalled();
  });

  it("returns 403 when the workspace member cap is reached without sending an invite", async () => {
    vi.mocked(countOrganizationMembers).mockResolvedValueOnce(25);

    const response = await POST(inviteRequest({ email: "new@example.com", role: "member" }));

    expect(response.status).toBe(403);
    expect(inviteMemberToOrganization).not.toHaveBeenCalled();
  });

  it("returns 429 when the hourly invite rate limit is exhausted", async () => {
    vi.mocked(checkInviteRateLimit).mockResolvedValueOnce("Invite limit reached (20 invites per hour). Try again later.");

    const response = await POST(inviteRequest({ email: "new@example.com", role: "member" }));

    expect(response.status).toBe(429);
    expect(inviteMemberToOrganization).not.toHaveBeenCalled();
  });

  it("propagates the 409 status when the invited email already has an account and skips the audit", async () => {
    vi.mocked(inviteMemberToOrganization).mockRejectedValueOnce(
      new DataAccessError("That email already has a Clear Close IQ account.", { status: 409 }),
    );

    const response = await POST(inviteRequest({ email: "existing@example.com", role: "member" }));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toContain("already has");
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
