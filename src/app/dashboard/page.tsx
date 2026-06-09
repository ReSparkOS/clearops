import Link from "next/link";
import { connection } from "next/server";
import { FileText, FolderUp, Plus, TriangleAlert, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ContractCalendarPanel } from "@/components/dashboard/contract-calendar";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { Section } from "@/components/ui/card";
import { buildContractCalendar } from "@/lib/calendar/deadline-calendar";
import { listTransactionsForDashboard } from "@/lib/db/transactions";
import type { TransactionRecord } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/domain/format";

export default async function DashboardPage() {
  await connection();

  const transactions = await listTransactionsForDashboard();
  const needsReview = transactions.filter((transaction) => transaction.status === "needs_review").length;
  const highRisk = transactions.filter((transaction) => transaction.status === "high_risk").length;
  const uploaded = transactions.filter((transaction) => transaction.extraction.documents.length > 0).length;
  const calendar = buildContractCalendar(transactions);

  return (
    <AppShell
      title="Dashboard"
      eyebrow="Transaction coordinator command center"
      action={
        <Link href="/transactions/new" className={buttonVariants()}>
          <Plus size={16} aria-hidden="true" />
          New transaction
        </Link>
      }
    >
      {transactions.length === 0 ? (
        <EmptyState
          icon={<FolderUp size={22} aria-hidden="true" />}
          title="No transactions yet"
          description="Create a transaction and upload a contract packet. Clear Close IQ extracts the terms, surfaces deadlines, and flags what needs review."
          action={
            <Link href="/transactions/new" className={buttonVariants()}>
              <Plus size={16} aria-hidden="true" />
              New transaction
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Active transactions" value={transactions.length} icon={<FileText size={17} />} />
            <MetricCard label="Needs review" value={needsReview} tone={needsReview ? "warn" : "default"} icon={<FileText size={17} />} />
            <MetricCard label="High risk" value={highRisk} tone={highRisk ? "bad" : "default"} icon={<TriangleAlert size={17} />} />
            <MetricCard label="Packets uploaded" value={uploaded} icon={<UploadCloud size={17} />} />
          </div>

          <ContractCalendarPanel calendar={calendar} />

          <Section title="Transactions" action={<span className="text-xs font-medium text-ink-muted">{transactions.length} total</span>} bodyClassName="p-0">
            <TransactionsTable transactions={transactions} />
          </Section>
        </div>
      )}
    </AppShell>
  );
}

function TransactionsTable({ transactions }: { transactions: TransactionRecord[] }) {
  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-ink-subtle">
            <tr>
              <th className="px-5 py-3 font-semibold">Property</th>
              <th className="px-3 py-3 font-semibold">Buyer</th>
              <th className="px-3 py-3 font-semibold">Closing</th>
              <th className="px-3 py-3 font-semibold">Price</th>
              <th className="px-3 py-3 font-semibold">Flags</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="transition-colors hover:bg-surface-muted">
                <td className="max-w-[280px] px-5 py-3">
                  <Link href={`/transactions/${transaction.id}`} className="block truncate font-medium text-ink hover:text-primary">
                    {transaction.propertyAddress}
                  </Link>
                </td>
                <td className="max-w-[160px] truncate px-3 py-3 text-ink-muted">{transaction.buyerNames.join(", ") || "—"}</td>
                <td className="px-3 py-3 text-ink-muted">{formatDate(transaction.closingDate)}</td>
                <td className="px-3 py-3 text-ink-muted">{formatCurrency(transaction.purchasePrice)}</td>
                <td className="px-3 py-3 text-ink-muted">{transaction.health.flags.length || "—"}</td>
                <td className="px-3 py-3">
                  <StatusBadge status={transaction.status} />
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="inline-flex gap-3">
                    <Link href={`/transactions/${transaction.id}`} className="font-semibold text-primary hover:text-primary-hover">
                      Open
                    </Link>
                    <Link href={`/transactions/${transaction.id}/upload`} className="font-semibold text-ink-muted hover:text-ink">
                      Upload
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-line md:hidden">
        {transactions.map((transaction) => (
          <li key={transaction.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/transactions/${transaction.id}`} className="min-w-0 font-medium text-ink hover:text-primary">
                <span className="block truncate">{transaction.propertyAddress}</span>
              </Link>
              <StatusBadge status={transaction.status} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              <span>{formatDate(transaction.closingDate)}</span>
              <span>{formatCurrency(transaction.purchasePrice)}</span>
              <span>{transaction.health.flags.length} flag(s)</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
