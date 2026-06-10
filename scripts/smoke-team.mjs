/* Live smoke test for the team/invites/roles feature. Requires a running dev
 * server and a confirmed owner account. Sends ONE real invite email to
 * SMOKE_INVITEE_EMAIL, then cleans up everything it created. Run:
 *   node --env-file=.env.local scripts/smoke-team.mjs
 */
import { createClient } from "@supabase/supabase-js";

const APP = process.env.SMOKE_APP_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;

const OWNER_EMAIL = process.env.SMOKE_OWNER_EMAIL ?? "qa-owner@clearcloseiq.test";
const OWNER_PASSWORD = process.env.SMOKE_OWNER_PASSWORD ?? "Sm0ke-Test-Passw0rd!";
const INVITEE_EMAIL = process.env.SMOKE_INVITEE_EMAIL ?? "simsnation95+ccq-invite-smoke@gmail.com";
const INVITEE_PASSWORD = "Invited-Smoke-Passw0rd!";

const admin = createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false } });
const results = [];
let failures = 0;

function check(name, ok, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: PUBLISHABLE },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`sign-in failed for ${email}: ${data.error_description ?? data.msg ?? res.status}`);
  return data.access_token;
}

async function api(method, path, token, body) {
  const res = await fetch(`${APP}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

let invitedUserId = null;

try {
  const ownerToken = await signIn(OWNER_EMAIL, OWNER_PASSWORD);

  // 1. Owner invites a teammate.
  const invite = await api("POST", "/api/members", ownerToken, { email: INVITEE_EMAIL, role: "member" });
  check("owner invite returns 201", invite.status === 201, JSON.stringify(invite.data));
  invitedUserId = invite.data.userId ?? null;

  // 2. Membership row exists with the chosen role.
  if (invitedUserId) {
    const { data: membership } = await admin
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", invitedUserId)
      .maybeSingle();
    check("membership row created with role=member", membership?.role === "member");
  }

  // 3. Simulate accepting the invite (set password + confirm), then sign in.
  if (invitedUserId) {
    const updated = await admin.auth.admin.updateUserById(invitedUserId, {
      password: INVITEE_PASSWORD,
      email_confirm: true,
    });
    check("invite acceptance simulated (password set)", !updated.error, updated.error?.message);
  }
  const memberToken = invitedUserId ? await signIn(INVITEE_EMAIL, INVITEE_PASSWORD) : null;

  // 4. The invited member lands in the SAME org and sees both members.
  if (memberToken) {
    const list = await api("GET", "/api/members", memberToken);
    check(
      "invited member sees the shared workspace (2 members)",
      list.status === 200 && list.data.members?.length === 2,
      `status ${list.status}, members ${list.data.members?.length}`,
    );

    // 5. Plain members cannot invite.
    const memberInvite = await api("POST", "/api/members", memberToken, { email: "x@example.com", role: "member" });
    check("member invite rejected with 403", memberInvite.status === 403);
  }

  // 6. Owner promotes the member to admin.
  if (invitedUserId) {
    const promote = await api("PATCH", `/api/members/${invitedUserId}`, ownerToken, { role: "admin" });
    check("owner promotes member to admin", promote.status === 200 && promote.data.role === "admin");
  }

  // 7. The new admin still cannot modify the owner.
  if (memberToken) {
    const { data: ownerRow } = await admin
      .from("organization_members")
      .select("user_id, role")
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    if (ownerRow) {
      const demoteOwner = await api("PATCH", `/api/members/${ownerRow.user_id}`, memberToken, { role: "member" });
      check("admin cannot modify the owner (403)", demoteOwner.status === 403, `status ${demoteOwner.status}`);
    }
  }

  // 8. Owner removes the member.
  if (invitedUserId) {
    const removal = await api("DELETE", `/api/members/${invitedUserId}`, ownerToken);
    check("owner removes the member", removal.status === 200 && removal.data.removed === true);

    const { data: gone } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("user_id", invitedUserId)
      .maybeSingle();
    check("membership row deleted", !gone);
  }

  // 9. Audit trail captured the lifecycle.
  const { data: audits } = await admin
    .from("audit_logs")
    .select("action")
    .in("action", ["member_invited", "member_role_changed", "member_removed"])
    .order("created_at", { ascending: false })
    .limit(10);
  const actions = new Set((audits ?? []).map((a) => a.action));
  check(
    "audit log has invite/role-change/remove events",
    actions.has("member_invited") && actions.has("member_role_changed") && actions.has("member_removed"),
    [...actions].join(", "),
  );
} catch (error) {
  check("smoke run completed", false, error.message);
} finally {
  // Clean up the invited auth user (cascades the profile row).
  if (invitedUserId) {
    const del = await admin.auth.admin.deleteUser(invitedUserId);
    check("cleanup: invited auth user deleted", !del.error, del.error?.message);
  }
}

console.log(results.join("\n"));
process.exit(failures ? 1 : 0);
