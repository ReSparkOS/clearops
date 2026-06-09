import type { FlagSeverity, HealthCheckStatus, PacketStatus, ReviewStatus, RiskStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "warn" | "good" | "bad" | "violet";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-line-strong bg-surface-muted text-ink-muted",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  good: "border-emerald-200 bg-emerald-50 text-emerald-700",
  bad: "border-rose-200 bg-rose-50 text-rose-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", TONE_CLASS[tone])}>
      <span className={cn("size-1.5 rounded-full", DOT_CLASS[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}

const DOT_CLASS: Record<Tone, string> = {
  neutral: "bg-ink-subtle",
  info: "bg-sky-500",
  warn: "bg-amber-500",
  good: "bg-emerald-500",
  bad: "bg-rose-500",
  violet: "bg-violet-500",
};

const PACKET_STATUS: Record<string, { tone: Tone; label: string }> = {
  not_uploaded: { tone: "neutral", label: "Not uploaded" },
  processing: { tone: "info", label: "Processing" },
  needs_review: { tone: "warn", label: "Needs review" },
  cleared: { tone: "good", label: "Cleared" },
  high_risk: { tone: "bad", label: "High risk" },
  error: { tone: "bad", label: "Extraction error" },
  processing_error: { tone: "bad", label: "Extraction error" },
};

export function StatusBadge({ status }: { status: PacketStatus | HealthCheckStatus }) {
  const config = PACKET_STATUS[status] ?? { tone: "neutral" as Tone, label: status };
  return <Pill tone={config.tone}>{config.label}</Pill>;
}

const SEVERITY: Record<FlagSeverity, { tone: Tone; label: string }> = {
  high: { tone: "bad", label: "High" },
  medium: { tone: "warn", label: "Medium" },
  low: { tone: "neutral", label: "Low" },
};

export function SeverityBadge({ severity }: { severity: FlagSeverity }) {
  const config = SEVERITY[severity];
  return <Pill tone={config.tone}>{config.label}</Pill>;
}

const REVIEW_STATUS: Record<ReviewStatus, { tone: Tone; label: string }> = {
  open: { tone: "neutral", label: "Open" },
  resolved: { tone: "good", label: "Resolved" },
  false_positive: { tone: "violet", label: "False positive" },
  needs_follow_up: { tone: "warn", label: "Needs follow-up" },
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const config = REVIEW_STATUS[status];
  return <Pill tone={config.tone}>{config.label}</Pill>;
}

const RISK: Record<RiskStatus, { tone: Tone; label: string }> = {
  open: { tone: "good", label: "On track" },
  due_soon: { tone: "warn", label: "Due soon" },
  expired: { tone: "bad", label: "Expired" },
  ambiguous: { tone: "neutral", label: "Needs date" },
  conflict: { tone: "bad", label: "Conflict" },
};

export function RiskBadge({ riskStatus }: { riskStatus: RiskStatus }) {
  const config = RISK[riskStatus];
  return <Pill tone={config.tone}>{config.label}</Pill>;
}
