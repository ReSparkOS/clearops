import type { AssignableRole } from "@/lib/auth/roles";
import { DataAccessError } from "@/lib/errors";
import { createAdminClient, withSchemaCacheRetry } from "@/lib/supabase/server";

export type OrganizationMember = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: string;
  /** "invited" until the user has signed in (accepting the invite link counts). */
  status: "active" | "invited";
  joinedAt: string;
};

export async function listOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
  const supabase = createAdminClient();

  const memberships = await withSchemaCacheRetry(() =>
    supabase
      .from("organization_members")
      .select("user_id, role, created_at, users ( email, full_name )")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
  );
  if (memberships.error) {
    throw asDataAccessError(memberships.error, "Could not list organization members.");
  }

  const rows = memberships.data ?? [];

  // Orgs are small (a TC team), so per-member auth lookups are fine. Status is
  // cosmetic; a failed lookup falls back to "active" rather than failing the page.
  return Promise.all(
    rows.map(async (row) => {
      const profile = (Array.isArray(row.users) ? row.users[0] : row.users) as
        | { email: string | null; full_name: string | null }
        | null;

      let status: OrganizationMember["status"] = "active";
      try {
        const { data } = await supabase.auth.admin.getUserById(row.user_id as string);
        if (data.user && !data.user.last_sign_in_at) {
          status = "invited";
        }
      } catch {
        // keep "active"
      }

      return {
        userId: row.user_id as string,
        email: profile?.email ?? null,
        fullName: profile?.full_name ?? null,
        role: row.role as string,
        status,
        joinedAt: row.created_at as string,
      };
    }),
  );
}

/**
 * Invites an email into the organization. Creates the auth user (Supabase sends
 * the invite email), then writes the profile and membership rows immediately so
 * the accept link drops the user straight into this org — the first-login
 * bootstrap in ensureUserOrganization finds the membership and creates nothing.
 */
export async function inviteMemberToOrganization(input: {
  organizationId: string;
  email: string;
  role: AssignableRole;
  redirectTo: string;
}): Promise<{ userId: string }> {
  const supabase = createAdminClient();

  // Creates the auth user and sends the invite email immediately.
  const invited = await supabase.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: input.redirectTo,
  });
  if (invited.error) {
    const alreadyExists =
      invited.error.code === "email_exists" || /already.*(registered|exists)/i.test(invited.error.message ?? "");
    if (alreadyExists) {
      throw existingAccountError();
    }
    throw new DataAccessError(invited.error.message ?? "Could not send the invite email.", {
      code: invited.error.code ?? undefined,
    });
  }
  const userId = invited.data.user?.id;
  if (!userId) {
    throw new DataAccessError("Invite succeeded but no user was returned.");
  }

  // inviteUserByEmail re-sends (rather than erroring) for an existing *unconfirmed*
  // user — e.g. someone with a pending invite in another workspace. Such a user
  // already has a membership row, so refuse rather than grafting a second org onto
  // them (which would make their first-login workspace nondeterministic).
  const existingMembership = await withSchemaCacheRetry(() =>
    supabase.from("organization_members").select("organization_id").eq("user_id", userId).limit(1).maybeSingle(),
  );
  if (existingMembership.error) {
    throw asDataAccessError(existingMembership.error, "Could not verify the invited user.");
  }
  if (existingMembership.data) {
    throw existingAccountError();
  }

  // The auth user is now ours (freshly created, no memberships). If either write
  // below fails, delete it so the address stays invitable and the invitee isn't
  // stranded in an empty personal workspace on first login. Even if the cleanup
  // itself fails, a retry self-heals: the user still has no membership row, so the
  // re-invite re-sends the email and the membership insert is attempted again.
  try {
    const profile = await withSchemaCacheRetry(() =>
      supabase
        .from("users")
        .upsert({ id: userId, email: input.email, full_name: null }, { onConflict: "id", ignoreDuplicates: true }),
    );
    if (profile.error) {
      throw asDataAccessError(profile.error, "Could not create the invited user's profile.");
    }

    const membership = await withSchemaCacheRetry(() =>
      supabase.from("organization_members").insert({
        organization_id: input.organizationId,
        user_id: userId,
        role: input.role,
      }),
    );
    if (membership.error) {
      throw asDataAccessError(membership.error, "Could not add the invited user to the organization.");
    }
  } catch (error) {
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    throw error;
  }

  return { userId };
}

/** Count of members in an organization — basis for the per-workspace member cap. */
export async function countOrganizationMembers(organizationId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("organization_members")
    .select("user_id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if (error) {
    throw asDataAccessError(error, "Could not count organization members.");
  }
  return count ?? 0;
}

/** Returns the member's role within the org, or null when not a member. */
export async function getMemberRole(organizationId: string, userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await withSchemaCacheRetry(() =>
    supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle(),
  );
  if (error) {
    throw asDataAccessError(error, "Could not look up the member.");
  }
  return (data?.role as string | undefined) ?? null;
}

export async function updateMemberRole(input: {
  organizationId: string;
  userId: string;
  role: AssignableRole;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await withSchemaCacheRetry(() =>
    supabase
      .from("organization_members")
      .update({ role: input.role })
      .eq("organization_id", input.organizationId)
      .eq("user_id", input.userId),
  );
  if (error) {
    throw asDataAccessError(error, "Could not update the member's role.");
  }
}

/**
 * Removes the membership row only — the auth account stays. A removed user who
 * signs in again gets a fresh personal workspace from the first-login bootstrap.
 */
export async function removeMember(input: { organizationId: string; userId: string }): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await withSchemaCacheRetry(() =>
    supabase
      .from("organization_members")
      .delete()
      .eq("organization_id", input.organizationId)
      .eq("user_id", input.userId),
  );
  if (error) {
    throw asDataAccessError(error, "Could not remove the member.");
  }
}

function existingAccountError() {
  return new DataAccessError(
    "That email already has a Clear Close IQ account. Joining an existing account to another workspace isn't supported yet.",
    { status: 409 },
  );
}

function asDataAccessError(error: { code?: string | null; message?: string }, fallbackMessage: string): DataAccessError {
  return new DataAccessError(error.message || fallbackMessage, { code: error.code ?? undefined });
}
