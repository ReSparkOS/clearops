"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlus, UserX } from "lucide-react";
import type { OrganizationMember } from "@/lib/db/members";
import { Button } from "@/components/ui/button";
import { Field, Input, controlClass } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function InviteForm() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [sending, setSending] = useState(false);

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);

    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? `Invite failed (${response.status}).`);
      }

      toast({ title: "Invite sent", description: `${email} was invited as ${ROLE_LABELS[role]}.`, variant: "success" });
      setEmail("");
      setRole("member");
      router.refresh();
    } catch (error) {
      toast({
        title: "Couldn't send invite",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={invite} className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Field label="Email" htmlFor="invite-email">
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@brokerage.com"
            required
            autoComplete="off"
          />
        </Field>
      </div>
      <div className="sm:w-40">
        <Field label="Role" htmlFor="invite-role">
          <select
            id="invite-role"
            value={role}
            onChange={(event) => setRole(event.target.value as "admin" | "member")}
            className={controlClass}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
      </div>
      <Button type="submit" disabled={sending} className="sm:shrink-0">
        <UserPlus size={16} aria-hidden="true" />
        {sending ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}

export function MemberRow({
  member,
  currentUserId,
  canManage,
}: {
  member: OrganizationMember;
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // Optimistic so the <select> reflects the choice immediately and doesn't snap
  // back to the server prop while the PATCH + router.refresh() round-trips.
  const [role, setRole] = useState(member.role);

  const isSelf = member.userId === currentUserId;
  const isOwner = member.role === "owner";
  const mutable = canManage && !isSelf && !isOwner;
  const displayName = member.fullName ?? member.email ?? "Unknown user";

  async function changeRole(nextRole: string) {
    const previous = role;
    setBusy(true);
    setRole(nextRole);
    try {
      const response = await fetch(`/api/members/${member.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? `Update failed (${response.status}).`);
      }
      toast({ title: "Role updated", variant: "success" });
      router.refresh();
    } catch (error) {
      setRole(previous);
      toast({
        title: "Couldn't update role",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove ${displayName} from this workspace?`)) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/members/${member.userId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? `Remove failed (${response.status}).`);
      }
      toast({ title: "Member removed", variant: "success" });
      router.refresh();
    } catch (error) {
      setBusy(false);
      toast({
        title: "Couldn't remove member",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-4">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold uppercase text-primary"
      >
        {(member.email ?? "?").slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {displayName}
          {isSelf ? <span className="ml-2 text-xs font-medium text-ink-subtle">(you)</span> : null}
        </p>
        <p className="truncate text-xs text-ink-muted">{member.email}</p>
      </div>

      {member.status === "invited" ? (
        <span className="inline-flex items-center rounded-full border border-line-strong bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-ink-muted">
          Invited
        </span>
      ) : null}

      {mutable ? (
        <div className="flex items-center gap-2">
          <select
            value={role}
            onChange={(event) => changeRole(event.target.value)}
            disabled={busy}
            aria-label={`Role for ${displayName}`}
            className={cn(controlClass, "h-9 w-auto px-2 text-xs font-medium")}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button
            type="button"
            variant="ghost-danger"
            size="sm"
            onClick={remove}
            disabled={busy}
            aria-label={`Remove ${displayName}`}
          >
            <UserX size={15} aria-hidden="true" />
            Remove
          </Button>
        </div>
      ) : (
        <span className="inline-flex items-center rounded-full border border-line-strong bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-ink-muted">
          {ROLE_LABELS[member.role] ?? member.role}
        </span>
      )}
    </li>
  );
}
