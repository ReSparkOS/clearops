import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, PencilLine, Sparkles, UploadCloud } from "lucide-react";
import type { PacketFacts, RiskStatus, TransactionRecord } from "@/lib/domain/types";
import { formatCurrency, formatDate, formatPercent, labelize, severityRank } from "@/lib/domain/format";
import { RiskBadge, SeverityBadge, StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { FlagActions } from "@/components/flags/flag-actions";

export function PacketHealthReport({ transaction }: { transaction: TransactionRecord }) {
  const { health, extraction } = transaction;
  const hasExtraction = extraction.documents.length > 0 || extraction.schemaVersion !== "not_uploaded";
  const sortedFlags = [...health.flags].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  const highCount = sortedFlags.filter((flag) => flag.severity === "high").length;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={transaction.status} />
              {hasExtraction ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                  <Sparkles size={12} aria-hidden="true" /> AI-extracted
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-lg font-semibold tracking-tight text-ink">Packet health check</h2>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-ink-muted">
              Clear Close IQ flags potential packet issues from the AI extraction and deterministic rules. Human review is
              required; this is not legal advice. Verify every value against the source documents.
            </p>
          </div>
          {hasExtraction ? (
            <RerunButton transactionId={transaction.id} />
          ) : null}
        </div>

        {hasExtraction ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Open flags" value={sortedFlags.length} icon={<AlertTriangle size={17} />} tone={sortedFlags.length ? "warn" : "good"} />
            <MetricCard label="High risk" value={highCount} icon={<AlertTriangle size={17} />} tone={highCount ? "bad" : "default"} />
            <MetricCard label="Documents" value={extraction.documents.length} icon={<FileText size={17} />} />
            <MetricCard label="Deadlines" value={health.deadlines.length} icon={<CalendarClock size={17} />} />
          </div>
        ) : (
          <UploadPrompt transactionId={transaction.id} />
        )}
      </section>

      {hasExtraction ? (
        <>
          <section className="grid gap-4 xl:grid-cols-2">
            <SummaryPanel transaction={transaction} />
            <KeyTermsPanel facts={transaction.extraction.facts} />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <DeadlinePanel transaction={transaction} />
            <DocumentsPanel transaction={transaction} />
          </section>

          <FlagsPanel flags={sortedFlags} />

          {health.amendmentChanges.length ? <AmendmentsPanel transaction={transaction} /> : null}
        </>
      ) : null}
    </div>
  );
}

function RerunButton({ transactionId }: { transactionId: string }) {
  return (
    <Link href={`/transactions/${transactionId}/upload`} className={buttonVariants({ variant: "secondary", className: "shrink-0" })}>
      <UploadCloud size={16} aria-hidden="true" />
      Manage packet
    </Link>
  );
}

function UploadPrompt({ transactionId }: { transactionId: string }) {
  return (
    <div className="mt-5 grid place-items-center rounded-lg border border-dashed border-line-strong bg-surface-muted px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
        <UploadCloud size={20} aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">No packet uploaded yet</p>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">Upload the contract packet to extract terms, deadlines, and review flags.</p>
      <Link href={`/transactions/${transactionId}/upload`} className={buttonVariants({ className: "mt-4" })}>
        <UploadCloud size={16} aria-hidden="true" />
        Upload packet
      </Link>
    </div>
  );
}

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SummaryPanel({ transaction }: { transaction: TransactionRecord }) {
  return (
    <Panel title="Transaction summary">
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label="Property" value={transaction.propertyAddress} />
        <Field label="Buyer" value={transaction.buyerNames.join(", ")} />
        <Field label="Seller" value={transaction.sellerNames.join(", ")} />
        <Field label="Price" value={formatCurrency(transaction.purchasePrice)} />
        <Field label="Closing" value={formatDate(transaction.closingDate)} />
        <Field label="Financing" value={transaction.financingType} />
      </dl>
    </Panel>
  );
}

function KeyTermsPanel({ facts }: { facts: PacketFacts }) {
  return (
    <Panel title="Key terms">
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label="Earnest money" value={formatCurrency(facts.earnest_money_amount)} />
        <Field label="Possession" value={facts.possession_terms} />
        <Field label="Seller concessions" value={facts.seller_concessions == null ? null : String(facts.seller_concessions)} />
        <Field label="Home warranty" value={facts.home_warranty_terms} />
        <Field label="Signatures" value={labelize(facts.signatures_detected)} />
        <Field label="Initials" value={labelize(facts.initials_detected)} />
      </dl>
    </Panel>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  const missing = value == null || value === "" || value === "Needs review";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className={missing ? "mt-1 text-sm font-medium text-ink-subtle italic" : "mt-1 break-words text-sm font-medium text-ink"}>
        {missing ? "Not found in packet" : value}
      </dd>
    </div>
  );
}

function DeadlinePanel({ transaction }: { transaction: TransactionRecord }) {
  const deadlines = [...transaction.health.deadlines].sort((a, b) => sortDate(a.date).localeCompare(sortDate(b.date)));

  return (
    <Panel title="Deadlines">
      {deadlines.length ? (
        <div className="space-y-2">
          {deadlines.map((deadline, index) => (
            <div key={`${deadline.name}-${index}`} className="flex items-start justify-between gap-3 rounded-lg border border-line p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{deadline.name}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {formatDate(deadline.date)} · Page {deadline.sourcePage ?? "n/a"} · {formatPercent(deadline.confidence)} confidence
                </p>
              </div>
              <RiskBadge riskStatus={deadline.riskStatus as RiskStatus} />
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-line bg-surface-muted p-3 text-sm font-medium text-ink-muted">No deadlines extracted.</p>
      )}
    </Panel>
  );
}

function DocumentsPanel({ transaction }: { transaction: TransactionRecord }) {
  return (
    <Panel title="Documents found" action={<span className="text-xs font-medium text-ink-muted">{transaction.extraction.documents.length}</span>}>
      <ul className="divide-y divide-line">
        {transaction.extraction.documents.map((document) => (
          <li key={document.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{labelize(document.documentType)}</p>
              <p className="truncate text-xs text-ink-muted">
                {document.filename}
                {document.pageStart ? ` · pp. ${document.pageStart}-${document.pageEnd ?? document.pageStart}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <a
                href={`/api/documents/${document.id}/url`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-primary hover:text-primary-hover"
              >
                View PDF
              </a>
              <span className="text-xs font-semibold text-ink-muted">{formatPercent(document.confidence)}</span>
            </div>
          </li>
        ))}
        {transaction.extraction.documents.length === 0 ? (
          <li className="py-3 text-sm font-medium text-ink-muted">No documents classified.</li>
        ) : null}
      </ul>
    </Panel>
  );
}

function FlagsPanel({ flags }: { flags: TransactionRecord["health"]["flags"] }) {
  return (
    <Panel
      title="Review flags"
      action={<span className="text-xs font-medium text-ink-muted">{flags.length} open</span>}
    >
      {flags.length === 0 ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          No flags detected. Confirm with the source documents before clearing.
        </p>
      ) : (
        <div className="space-y-2.5">
          {flags.map((flag) => (
            <div key={flag.id} className="rounded-lg border border-line p-3.5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={flag.severity} />
                    <span className="rounded-full border border-line-strong bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                      {labelize(flag.category)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink">{flag.title}</p>
                  <p className="mt-1 text-sm leading-5 text-ink-muted">{flag.explanation}</p>
                </div>
                <FlagActions flagId={flag.id} initialStatus={flag.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
                <span>{formatPercent(flag.confidence)} confidence</span>
                <span>Page {flag.sourcePage ?? "n/a"}</span>
                {flag.requiredDocument ? <span>Required: {labelize(flag.requiredDocument)}</span> : null}
              </div>
              <div className="mt-2 flex items-start gap-2 rounded-md bg-surface-muted p-2 text-xs leading-5 text-ink-muted">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>{flag.suggestedAction}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function AmendmentsPanel({ transaction }: { transaction: TransactionRecord }) {
  return (
    <Panel title="Amendment / counteroffer changes">
      <div className="space-y-2">
        {transaction.health.amendmentChanges.map((change, index) => (
          <div key={`${change.field}-${index}`} className="rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <PencilLine size={15} className="text-amber-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-ink">{labelize(change.field)} changed</p>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Human review</span>
            </div>
            <p className="mt-1.5 text-sm leading-6 text-ink-muted">
              {String(change.originalValue)} → {String(change.newValue)}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function sortDate(value: string | null) {
  return value ?? "9999-12-31";
}
