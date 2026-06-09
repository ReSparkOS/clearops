"use client";

import { useState } from "react";
import type { ReviewStatus } from "@/lib/domain/types";
import { ReviewStatusBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

const options: { value: ReviewStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "needs_follow_up", label: "Needs follow-up" },
  { value: "resolved", label: "Resolved" },
  { value: "false_positive", label: "False positive" },
];

export function FlagActions({ flagId, initialStatus }: { flagId: string; initialStatus: ReviewStatus }) {
  const toast = useToast();
  const [status, setStatus] = useState<ReviewStatus>(initialStatus);
  const [saving, setSaving] = useState(false);

  async function updateStatus(nextStatus: ReviewStatus) {
    const previous = status;
    setSaving(true);
    setStatus(nextStatus);

    try {
      const response = await fetch(`/api/flags/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? `Update failed (${response.status}).`);
      }

      toast({ title: "Flag updated", variant: "success" });
    } catch (error) {
      setStatus(previous);
      toast({
        title: "Couldn't update flag",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2 lg:shrink-0">
      <ReviewStatusBadge status={status} />
      <select
        value={status}
        onChange={(event) => updateStatus(event.target.value as ReviewStatus)}
        disabled={saving}
        aria-label="Flag review status"
        className="h-9 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-ink shadow-card outline-none transition hover:border-line-strong disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
