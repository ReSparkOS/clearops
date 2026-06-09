import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireOrgContext } from "@/lib/auth/session";
import { buttonVariants } from "@/components/ui/button";
import { PacketHealthReport } from "@/components/health/packet-health-report";
import { getTransactionRecord } from "@/lib/db/transactions";

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const { organizationId } = await requireOrgContext();
  const transaction = await getTransactionRecord(id, organizationId);

  if (!transaction) {
    notFound();
  }

  return (
    <AppShell
      active="Transaction"
      title={transaction.propertyAddress}
      eyebrow="Transaction detail"
      primaryTransactionId={transaction.id}
      action={
        <Link href={`/transactions/${transaction.id}/upload`} className={buttonVariants()}>
          <UploadCloud size={16} aria-hidden="true" />
          Upload packet
        </Link>
      }
    >
      <PacketHealthReport transaction={transaction} />
    </AppShell>
  );
}
