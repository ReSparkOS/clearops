import type { FlagSeverity, HealthCheckStatus, PacketStatus } from "@/lib/domain/types";

export function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "Needs review";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Needs review";
  }

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "n/a";
  }

  return `${Math.round(value * 100)}%`;
}

export function labelize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function packetStatusLabel(status: PacketStatus | HealthCheckStatus) {
  const labels: Record<string, string> = {
    not_uploaded: "Not uploaded",
    processing: "Processing",
    needs_review: "Needs review",
    cleared: "Cleared",
    error: "Error",
    high_risk: "High risk",
    processing_error: "Processing error",
  };

  return labels[status] ?? labelize(status);
}

export function severityRank(severity: FlagSeverity) {
  return severity === "high" ? 3 : severity === "medium" ? 2 : 1;
}
