import { z } from "zod";
import { ASSIGNABLE_ROLES, canManageTeam } from "@/lib/auth/roles";
import { getApiOrgContext } from "@/lib/auth/session";
import { checkInviteRateLimit, recordAuditEvent } from "@/lib/db/audit";
import { countOrganizationMembers, inviteMemberToOrganization, listOrganizationMembers } from "@/lib/db/members";
import { DataAccessError, toErrorPayload } from "@/lib/errors";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(ASSIGNABLE_ROLES),
});

const MAX_MEMBERS = Number(process.env.MAX_ORG_MEMBERS ?? 25);

export async function GET(request: Request) {
  try {
    const context = await getApiOrgContext(request);
    if (!context) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const members = await listOrganizationMembers(context.organizationId);
    return Response.json({ members });
  } catch (error) {
    const status = error instanceof DataAccessError ? error.status : 500;
    return Response.json(toErrorPayload(error), { status });
  }
}

export async function POST(request: Request) {
  try {
    const context = await getApiOrgContext(request);
    if (!context) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (!canManageTeam(context.role)) {
      return Response.json({ error: "Only owners and admins can invite teammates." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const { email, role } = inviteSchema.parse(body);

    // Each invite sends a real email and creates an auth user — cap both the rate
    // and the workspace size so a bug or abuser can't email-bomb or bloat the org.
    if (Number.isFinite(MAX_MEMBERS) && MAX_MEMBERS > 0) {
      const memberCount = await countOrganizationMembers(context.organizationId);
      if (memberCount >= MAX_MEMBERS) {
        return Response.json(
          { error: `Workspace member limit reached (${MAX_MEMBERS}). Remove a member before inviting another.` },
          { status: 403 },
        );
      }
    }
    const rateLimitError = await checkInviteRateLimit(context.organizationId);
    if (rateLimitError) {
      return Response.json({ error: rateLimitError }, { status: 429 });
    }

    // The invite email's accept link lands on the password setup page.
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
    const { userId } = await inviteMemberToOrganization({
      organizationId: context.organizationId,
      email,
      role,
      redirectTo: `${origin}/reset-password`,
    });

    await recordAuditEvent({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "member_invited",
      metadata: { invitedUserId: userId, email, role },
    });

    return Response.json({ userId, email, role, status: "invited" }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Provide a valid email and a role of admin or member." }, { status: 400 });
    }
    const status = error instanceof DataAccessError ? error.status : 500;
    return Response.json(toErrorPayload(error), { status });
  }
}
