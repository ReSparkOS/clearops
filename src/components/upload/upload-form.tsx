"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw, UploadCloud } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { buildUploadStatusMessage, readUploadResponse } from "./upload-response";

export function UploadForm({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);

  async function submitUpload() {
    if (!files || files.length === 0) {
      toast({ title: "Select at least one PDF packet.", variant: "error" });
      return;
    }

    setLoading(true);
    setWarnings([]);
    setCompleted(false);

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));

    try {
      const response = await fetch(`/api/transactions/${transactionId}/upload`, { method: "POST", body: formData });
      const data = await readUploadResponse(response);

      if (!response.ok) {
        toast({ title: "Upload failed", description: [data.error, data.hint].filter(Boolean).join(" "), variant: "error" });
        return;
      }

      setWarnings(data.warnings ?? []);

      if (data.status === "failed") {
        toast({
          title: "Extraction failed",
          description: data.error ?? "The packet could not be extracted. No demo data was saved.",
          variant: "error",
        });
        return;
      }

      toast({ title: "Packet processed", description: buildUploadStatusMessage(data), variant: "success" });
      setCompleted(true);
      router.refresh();
    } catch (caught) {
      toast({ title: "Upload failed", description: caught instanceof Error ? caught.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function rerunExtraction() {
    setLoading(true);
    setWarnings([]);
    setCompleted(false);

    try {
      const response = await fetch(`/api/transactions/${transactionId}/rerun`, { method: "POST" });
      const data = await readUploadResponse(response);

      if (!response.ok) {
        toast({ title: "Re-run failed", description: [data.error, data.hint].filter(Boolean).join(" "), variant: "error" });
        return;
      }

      setWarnings(data.warnings ?? []);

      if (data.status === "failed") {
        toast({ title: "Re-run failed", description: data.error, variant: "error" });
        return;
      }

      toast({ title: "Re-extraction complete", description: buildUploadStatusMessage(data), variant: "success" });
      setCompleted(true);
      router.refresh();
    } catch (caught) {
      toast({ title: "Re-run failed", description: caught instanceof Error ? caught.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <div className="grid gap-4">
        <label className="group grid cursor-pointer place-items-center rounded-xl border border-dashed border-line-strong bg-surface-muted px-4 py-10 text-center transition-colors hover:border-primary hover:bg-primary-soft/40">
          <UploadCloud className="text-primary" size={28} aria-hidden="true" />
          <span className="mt-3 text-sm font-semibold text-ink">Upload PDF packet files</span>
          <span className="mt-1 text-xs text-ink-muted">Text-based PDFs, up to 25 MB each. Re-uploading replaces the current packet.</span>
          <input type="file" accept="application/pdf,.pdf" multiple className="sr-only" onChange={(event) => setFiles(event.target.files)} />
          <span className="mt-3 text-xs font-medium text-ink-subtle">
            {files?.length ? Array.from(files).map((file) => file.name).join(", ") : "No file selected"}
          </span>
        </label>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={submitUpload} disabled={loading}>
            <UploadCloud size={16} aria-hidden="true" />
            {loading ? "Processing…" : "Upload and extract"}
          </Button>
          <Button type="button" variant="secondary" onClick={rerunExtraction} disabled={loading}>
            <RotateCcw size={16} aria-hidden="true" />
            Re-run on stored packet
          </Button>
        </div>

        {warnings.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Completed with warning(s):</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {completed ? (
          <div className="flex flex-wrap gap-3">
            <Link href={`/transactions/${transactionId}/health-check`} className={buttonVariants()}>
              View health check
            </Link>
            <Link href={`/transactions/${transactionId}`} className={buttonVariants({ variant: "secondary" })}>
              Open transaction
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
