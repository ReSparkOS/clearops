import { connection } from "next/server";
import { AppShell } from "@/components/app-shell";
import { InviteForm, MemberRow } from "@/components/team/team-manager";
import { Section } from "@/components/ui/card";
import { canManageTeam } from "@/lib/auth/roles";
import { requireOrgContext } from "@/lib/auth/session";
import { listOrganizationMembers } from "@/lib/db/members";

export default async function TeamPage() {
  await connection();

  const context = await requireOrgContext();
  const members = await listOrganizationMembers(context.organizationId);
  const canManage = canManageTeam(context.role);

  return (
    <AppShell title="Team" eyebrow="Settings">
      <div className="space-y-6">
        {canManage ? (
          <Section
            title="Invite a teammate"
            description="They'll get an email link to set a password and join this workspace."
          >
            <InviteForm />
          </Section>
        ) : null}

        <Section
          title="Members"
          description={
            canManage
              ? "Owners and admins manage the team and settings; members work transactions."
              : "Ask an owner or admin to change roles or invite teammates."
          }
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-line">
            {members.map((member) => (
              <MemberRow key={member.userId} member={member} currentUserId={context.user.id} canManage={canManage} />
            ))}
          </ul>
        </Section>
      </div>
    </AppShell>
  );
}
