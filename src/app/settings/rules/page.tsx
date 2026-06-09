import { AppShell } from "@/components/app-shell";
import { Section } from "@/components/ui/card";

const rules = [
  ["Lead-based paint", "Pre-1978 properties require a lead-based paint disclosure; a missing year built is a review flag."],
  ["Financing", "Financed contracts require matching financing terms or an applicable FHA, VA, USDA, conventional, appraisal, or financing addendum."],
  ["Cash", "Cash purchases require proof of funds or a documented false positive."],
  ["Referenced documents", "References to addenda, exhibits, attached notices, or inspection resolutions must match a document in the packet."],
  ["Signatures & dates", "Signature, initial, and date findings use likely-complete, needs-review, missing, or unknown."],
  ["Deadlines", "Extracted deadlines are checked for missing, ambiguous, expired, due-soon, and conflicting statuses."],
];

export default function RulesPage() {
  return (
    <AppShell title="Rules" eyebrow="Missouri residential · v1">
      <Section
        title="Rule library"
        description="Deterministic checks applied to every extracted packet."
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink-muted">
            MO Residential v1
          </span>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {rules.map(([title, description]) => (
            <div key={title} className="rounded-lg border border-line p-4 transition-colors hover:border-line-strong">
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="mt-1.5 text-sm leading-6 text-ink-muted">{description}</p>
            </div>
          ))}
        </div>
      </Section>
    </AppShell>
  );
}
