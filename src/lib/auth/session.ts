import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createAdminClient, createClient, withSchemaCacheRetry } from "@/lib/supabase/server";
import { DataAccessError } from "@/lib/errors";

export type OrgContext = {
  user: User;
  organizationId: string;
  role: string;
};

/**
 * Resolves the authenticated user from the request cookies, or from an
 * `Authorization: Bearer <access token>` header (used by scripts and API clients).
 */
export async function getSessionUser(request?: Request): Promise<User | null> {
  const bearer = request?.headers.get("authorization")?.match(/^bearer\s+(.+)$/i)?.[1];

  if (bearer) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(bearer);
    return error ? null : data.user;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

/**
 * Every authenticated user belongs to exactly one organization (created on first
 * use). Returns the user's org id + role, bootstrapping profile, organization,
 * and owner membership for first-time users.
 */
export async function ensureUserOrganization(user: User): Promise<{ organizationId: string; role: string }> {
  const supabase = createAdminClient();

  const membership = await withSchemaCacheRetry(() =>
    supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  );
  if (membership.error) {
    throw new DataAccessError(membership.error.message ?? "Could not look up organization membership.");
  }
  if (membership.data) {
    return { organizationId: membership.data.organization_id as string, role: membership.data.role as string };
  }

  const profile = await withSchemaCacheRetry(() =>
    supabase
      .from("users")
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
          full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
        },
        { onConflict: "id", ignoreDuplicates: true },
      ),
  );
  if (profile.error) {
    throw new DataAccessError(profile.error.message ?? "Could not create the user profile.");
  }

  const orgName = workspaceNameFor(user);
  const organization = await withSchemaCacheRetry(() =>
    supabase.from("organizations").insert({ name: orgName }).select("id").single(),
  );
  if (organization.error || !organization.data) {
    throw new DataAccessError(organization.error?.message ?? "Could not create the organization.");
  }
  const organizationId = organization.data.id as string;

  const member = await withSchemaCacheRetry(() =>
    supabase.from("organization_members").insert({
      organization_id: organizationId,
      user_id: user.id,
      role: "owner",
    }),
  );
  if (member.error) {
    throw new DataAccessError(member.error.message ?? "Could not create the organization membership.");
  }

  return { organizationId, role: "owner" };
}

/** For server components/pages: redirects to /login when unauthenticated. */
export async function requireOrgContext(): Promise<OrgContext> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const { organizationId, role } = await ensureUserOrganization(user);
  return { user, organizationId, role };
}

/** For API routes: returns null when unauthenticated (caller responds 401). */
export async function getApiOrgContext(request: Request): Promise<OrgContext | null> {
  const user = await getSessionUser(request);
  if (!user) {
    return null;
  }
  const { organizationId, role } = await ensureUserOrganization(user);
  return { user, organizationId, role };
}

function workspaceNameFor(user: User) {
  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
  if (fullName) {
    return `${fullName}'s workspace`;
  }
  const localPart = user.email?.split("@")[0];
  return localPart ? `${localPart}'s workspace` : "My workspace";
}
