import { z } from "zod";
import { ASSIGNABLE_ROLES, canManageTeam } from "@/lib/auth/roles";
import { getApiOrgContext } from "@/lib/auth/session";
import type { OrgContext } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/db/audit";
import { getMemberRole, removeMember, updateMemberRole } from "@/lib/db/members";
import { DataAccessError, toErrorPayload } from "@/lib/errors";
import { isUuid } from "@/lib/utils";

const roleSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES),
});

/**
 * Shared guards for mutating a member: actor must be owner/admin, the target
 * must belong to the same org, must not be the owner, and must not be the
 * actor themself (no self-demotion/self-removal — prevents orphaning the team).
 * Returns an error Response, or the target's current role when allowed.
 */
async function guardMemberMutation(context: OrgContext, targetUserId: string): Promise<Response | { targetRole: string }> {
  if (!canManageTeam(context.role)) {
    return Response.json({ error: "Only owners and admins can manage the team." }, { status: 403 });
  }
  if (targetUserId === context.user.id) {
    return Response.json({ error: "You can't change or remove your own membership." }, { status: 400 });
  }
  if (!isUuid(targetUserId)) {
    return Response.json({ error: "Member not found." }, { status: 404 });
  }

  const targetRole = await getMemberRole(context.organizationId, targetUserId);
  if (!targetRole) {
    return Response.json({ error: "Member not found." }, { status: 404 });
  }
  if (targetRole === "owner") {
    return Response.json({ error: "The workspace owner can't be changed or removed." }, { status: 403 });
  }
  return { targetRole };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;

    const context = await getApiOrgContext(request);
    if (!context) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const guard = await guardMemberMutation(context, userId);
    if (guard instanceof Response) {
      return guard;
    }

    const body = await request.json().catch(() => null);
    const { role } = roleSchema.parse(body);

    await updateMemberRole({ organizationId: context.organizationId, userId, role });

    await recordAuditEvent({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "member_role_changed",
      metadata: { memberUserId: userId, from: guard.targetRole, to: role },
    });

    return Response.json({ userId, role });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Role must be admin or member." }, { status: 400 });
    }
    const status = error instanceof DataAccessError ? error.status : 500;
    return Response.json(toErrorPayload(error), { status });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;

    const context = await getApiOrgContext(request);
    if (!context) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const guard = await guardMemberMutation(context, userId);
    if (guard instanceof Response) {
      return guard;
    }

    await removeMember({ organizationId: context.organizationId, userId });

    await recordAuditEvent({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "member_removed",
      metadata: { memberUserId: userId, previousRole: guard.targetRole },
    });

    return Response.json({ userId, removed: true });
  } catch (error) {
    const status = error instanceof DataAccessError ? error.status : 500;
    return Response.json(toErrorPayload(error), { status });
  }
}
