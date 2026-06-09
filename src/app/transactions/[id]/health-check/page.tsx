import { connection } from "next/server";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PacketHealthReport } from "@/components/health/packet-health-report";
import { getTransactionRecord } from "@/lib/db/transactions";

export default async function HealthCheckPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const transaction = await getTransactionRecord(id);

  if (!transaction) {
    notFound();
  }

  return (
    <AppShell active="Health Check" title="Packet Health Check" eyebrow={transaction.propertyAddress} primaryTransactionId={transaction.id}>
      <PacketHealthReport transaction={transaction} />
    </AppShell>
  );
}
