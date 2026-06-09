import { buildContractCalendar } from "@/lib/calendar/deadline-calendar";
import { listTransactionsForDashboard } from "@/lib/db/transactions";
import { createAdminClient, withSchemaCacheRetry } from "@/lib/supabase/server";
import { toErrorPayload } from "@/lib/errors";

export const runtime = "nodejs";

type OrgDigest = {
  organizationId: string;
  organizationName: string;
  recipients: string[];
  items: { name: string; propertyAddress: string; dateLabel: string; riskStatus: string }[];
};

/**
 * Daily deadline digest. Triggered by Vercel Cron (see vercel.json); authenticates with
 * CRON_SECRET. Sends one email per organization listing expired and due-soon deadlines.
 * Without RESEND_API_KEY configured it runs as a dry run and reports what it would send.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && !cronSecret) {
    return Response.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const digests = await buildDigests();
    const resendKey = process.env.RESEND_API_KEY;

    if (!resendKey) {
      return Response.json({
        status: "dry_run",
        hint: "Set RESEND_API_KEY (and EMAIL_FROM) to enable delivery.",
        digests,
      });
    }

    let sent = 0;
    const failures: string[] = [];
    for (const digest of digests) {
      if (digest.recipients.length === 0 || digest.items.length === 0) {
        continue;
      }
      try {
        await sendDigestEmail(resendKey, digest);
        sent += 1;
      } catch (error) {
        failures.push(`${digest.organizationName}: ${error instanceof Error ? error.message : "send failed"}`);
      }
    }

    return Response.json({ status: "sent", organizations: digests.length, emailsSent: sent, failures });
  } catch (error) {
    return Response.json(toErrorPayload(error), { status: 500 });
  }
}

async function buildDigests(): Promise<OrgDigest[]> {
  const supabase = createAdminClient();

  const organizations = await withSchemaCacheRetry(() =>
    supabase.from("organizations").select("id, name").limit(500),
  );
  if (organizations.error) {
    throw new Error(organizations.error.message ?? "Could not list organizations.");
  }

  const digests: OrgDigest[] = [];
  for (const org of (organizations.data ?? []) as { id: string; name: string }[]) {
    const transactions = await listTransactionsForDashboard(org.id);
    if (transactions.length === 0) {
      continue;
    }

    const calendar = buildContractCalendar(transactions);
    const urgent = calendar.upcoming.filter(
      (event) => event.riskStatus === "due_soon" || event.riskStatus === "expired",
    );
    if (urgent.length === 0) {
      continue;
    }

    const members = await withSchemaCacheRetry(() =>
      supabase.from("organization_members").select("users(email)").eq("organization_id", org.id),
    );
    const recipients = ((members.data ?? []) as unknown as { users: { email: string | null } | null }[])
      .map((row) => row.users?.email)
      .filter((email): email is string => Boolean(email));

    digests.push({
      organizationId: org.id,
      organizationName: org.name,
      recipients,
      items: urgent.map((event) => ({
        name: event.name,
        propertyAddress: event.propertyAddress,
        dateLabel: event.dayLabel,
        riskStatus: event.riskStatus,
      })),
    });
  }

  return digests;
}

async function sendDigestEmail(apiKey: string, digest: OrgDigest) {
  const from = process.env.EMAIL_FROM ?? "ClearCloseIQ <onboarding@resend.dev>";
  const lines = digest.items.map(
    (item) =>
      `<li><strong>${escapeHtml(item.name)}</strong> — ${escapeHtml(item.propertyAddress)} · ${escapeHtml(item.dateLabel)} (${item.riskStatus === "expired" ? "EXPIRED" : "due soon"})</li>`,
  );

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: digest.recipients,
      subject: `Deadline alert: ${digest.items.length} contract deadline(s) need attention`,
      html: `<p>The following contract deadlines are expired or due soon:</p><ul>${lines.join("")}</ul><p>— ClearCloseIQ. Verify every deadline against the source documents.</p>`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend ${response.status}: ${body.slice(0, 200)}`);
  }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
