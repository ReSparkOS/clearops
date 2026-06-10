import { beforeEach, describe, expect, it, vi } from "vitest";
import { getApiOrgContext } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/db/audit";
import { getMemberRole, removeMember, updateMemberRole } from "@/lib/db/members";
import { DELETE, PATCH } from "./route";

const ORG_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const MEMBER_ID = "44444444-4444-4444-8444-444444444444";
const OWNER_ID = "66666666-6666-4666-8666-666666666666";

vi.mock("@/lib/auth/session", () => ({
  getApiOrgContext: vi.fn(async () => ({
    user: { id: ADMIN_ID },
    organizationId: ORG_ID,
    role: "admin",
  })),
}));

vi.mock("@/lib/db/members", () => ({
  getMemberRole: vi.fn(async () => "member"),
  updateMemberRole: vi.fn(async () => {}),
  removeMember: vi.fn(async () => {}),
}));

vi.mock("@/lib/db/audit", () => ({
  recordAuditEvent: vi.fn(async () => {}),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/members/x", {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const deleteRequest = () => new Request("http://localhost/api/members/x", { method: "DELETE" });
const params = (userId: string) => ({ params: Promise.resolve({ userId }) });

function asMemberContext(userId: string) {
  return {
    user: { id: userId },
    organizationId: ORG_ID,
    role: "member",
  } as Awaited<ReturnType<typeof getApiOrgContext>>;
}

describe("member mutation route — PATCH", () => {
  it("lets an admin change a member's role and records the audit event with correct attribution", async () => {
    const response = await PATCH(patchRequest({ role: "admin" }), params(MEMBER_ID));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateMemberRole).toHaveBeenCalledWith({ organizationId: ORG_ID, userId: MEMBER_ID, role: "admin" });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "member_role_changed",
        organizationId: ORG_ID,
        actorId: ADMIN_ID,
        metadata: expect.objectContaining({ memberUserId: MEMBER_ID, from: "member", to: "admin" }),
      }),
    );
    expect(payload).toMatchObject({ userId: MEMBER_ID, role: "admin" });
  });

  it("rejects unauthenticated PATCH with 401 and mutates nothing", async () => {
    vi.mocked(getApiOrgContext).mockResolvedValueOnce(null);

    const response = await PATCH(patchRequest({ role: "admin" }), params(MEMBER_ID));

    expect(response.status).toBe(401);
    expect(updateMemberRole).not.toHaveBeenCalled();
  });

  it("refuses to modify the workspace owner", async () => {
    vi.mocked(getMemberRole).mockResolvedValueOnce("owner");

    const response = await PATCH(patchRequest({ role: "member" }), params(OWNER_ID));

    expect(response.status).toBe(403);
    expect(updateMemberRole).not.toHaveBeenCalled();
  });

  it("refuses self-modification without touching the data layer", async () => {
    const response = await PATCH(patchRequest({ role: "member" }), params(ADMIN_ID));

    expect(response.status).toBe(400);
    expect(getMemberRole).not.toHaveBeenCalled();
    expect(updateMemberRole).not.toHaveBeenCalled();
  });

  it("rejects plain members managing the team without touching the data layer", async () => {
    vi.mocked(getApiOrgContext).mockResolvedValueOnce(asMemberContext(MEMBER_ID));

    const response = await PATCH(patchRequest({ role: "admin" }), params(OWNER_ID));

    expect(response.status).toBe(403);
    expect(getMemberRole).not.toHaveBeenCalled();
    expect(updateMemberRole).not.toHaveBeenCalled();
  });

  it("rejects escalation to owner, unknown roles, and a missing role with 400", async () => {
    const toOwner = await PATCH(patchRequest({ role: "owner" }), params(MEMBER_ID));
    const garbage = await PATCH(patchRequest({ role: "superadmin" }), params(MEMBER_ID));
    const missing = await PATCH(patchRequest({}), params(MEMBER_ID));
    const malformed = await PATCH(patchRequest("{not json"), params(MEMBER_ID));

    expect(toOwner.status).toBe(400);
    expect(garbage.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(malformed.status).toBe(400);
    expect(updateMemberRole).not.toHaveBeenCalled();
  });

  it("returns 404 for a non-UUID target without querying the data layer", async () => {
    const response = await PATCH(patchRequest({ role: "admin" }), params("not-a-uuid"));

    expect(response.status).toBe(404);
    expect(getMemberRole).not.toHaveBeenCalled();
    expect(updateMemberRole).not.toHaveBeenCalled();
  });
});

describe("member mutation route — DELETE", () => {
  it("removes a member and records the audit event with correct attribution", async () => {
    const response = await DELETE(deleteRequest(), params(MEMBER_ID));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(removeMember).toHaveBeenCalledWith({ organizationId: ORG_ID, userId: MEMBER_ID });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member_removed", organizationId: ORG_ID, actorId: ADMIN_ID }),
    );
    expect(payload).toMatchObject({ userId: MEMBER_ID, removed: true });
  });

  it("rejects unauthenticated DELETE with 401 and removes nothing", async () => {
    vi.mocked(getApiOrgContext).mockResolvedValueOnce(null);

    const response = await DELETE(deleteRequest(), params(MEMBER_ID));

    expect(response.status).toBe(401);
    expect(removeMember).not.toHaveBeenCalled();
  });

  it("refuses to remove the workspace owner", async () => {
    vi.mocked(getMemberRole).mockResolvedValueOnce("owner");

    const response = await DELETE(deleteRequest(), params(OWNER_ID));

    expect(response.status).toBe(403);
    expect(removeMember).not.toHaveBeenCalled();
  });

  it("refuses self-removal", async () => {
    const response = await DELETE(deleteRequest(), params(ADMIN_ID));

    expect(response.status).toBe(400);
    expect(removeMember).not.toHaveBeenCalled();
  });

  it("rejects plain members removing teammates", async () => {
    vi.mocked(getApiOrgContext).mockResolvedValueOnce(asMemberContext(MEMBER_ID));

    const response = await DELETE(deleteRequest(), params(OWNER_ID));

    expect(response.status).toBe(403);
    expect(removeMember).not.toHaveBeenCalled();
  });

  it("returns 404 for a target outside the organization", async () => {
    vi.mocked(getMemberRole).mockResolvedValueOnce(null);

    const response = await DELETE(deleteRequest(), params(MEMBER_ID));

    expect(response.status).toBe(404);
    expect(removeMember).not.toHaveBeenCalled();
  });
});
