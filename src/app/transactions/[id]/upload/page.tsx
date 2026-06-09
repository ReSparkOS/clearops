import { connection } from "next/server";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { UploadForm } from "@/components/upload/upload-form";
import { getTransactionRecord } from "@/lib/db/transactions";

export default async function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const transaction = await getTransactionRecord(id);

  if (!transaction) {
    notFound();
  }

  return (
    <AppShell active="Upload" title="Upload packet" eyebrow={transaction.propertyAddress} primaryTransactionId={transaction.id}>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <UploadForm transactionId={transaction.id} />
        <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink">How extraction works</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Real extraction only. If a PDF can&apos;t be read, you&apos;ll see an error — never placeholder data.
          </p>
          <ol className="mt-4 grid gap-3">
            {[
              "Store the uploaded PDFs in Supabase Storage",
              "Extract text with page markers on the server",
              "Classify documents with schema-bound AI output",
              "Run the Missouri residential rules engine",
              "Save flags with confidence, source page, and review status",
            ].map((item, index) => (
              <li key={item} className="flex gap-3 rounded-lg border border-line p-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <p className="text-sm font-medium text-ink-muted">{item}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </AppShell>
  );
}
