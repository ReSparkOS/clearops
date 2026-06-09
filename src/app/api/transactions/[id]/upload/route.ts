import { persistExtractionResult } from "@/lib/db/persistence";
import { DataAccessError, toErrorPayload } from "@/lib/errors";
import { combinePipelineResults } from "@/lib/extraction/combine-results";
import { runExtractionPipeline, type ExtractionPipelineResult } from "@/lib/extraction/pipeline";
import { storePacketDocument } from "@/lib/storage/documents";

export const runtime = "nodejs";

const MAX_FILES = 25;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return Response.json({ error: "Upload must be multipart/form-data with one or more PDF files." }, { status: 400 });
    }

    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    if (files.length === 0) {
      return Response.json({ error: "No PDF files were uploaded." }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return Response.json({ error: `Too many files. Upload at most ${MAX_FILES} PDFs at once.` }, { status: 400 });
    }

    const results: ExtractionPipelineResult[] = [];
    const storagePaths = new Map<string, string>();
    const warnings: string[] = [];
    let processed = 0;

    for (const file of files) {
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const validationError = validatePdf(file.name, fileBuffer);
      if (validationError) {
        return Response.json({ error: validationError }, { status: 400 });
      }

      try {
        const stored = await storePacketDocument({
          transactionId: id,
          filename: file.name,
          contentType: file.type || "application/pdf",
          fileBuffer,
        });
        if (stored?.path) {
          storagePaths.set(file.name, stored.path);
        }
      } catch (error) {
        warnings.push(`Could not store ${file.name}: ${errorMessage(error)}`);
      }

      const result = await runExtractionPipeline({ filename: file.name, fileBuffer });
      if (result.mode === "failed" && result.error) {
        warnings.push(`${file.name}: ${result.error}`);
      }
      results.push(result);
      processed += 1;
    }

    const combined = combinePipelineResults(results);

    if (!combined) {
      return Response.json(
        { processed, status: "failed", error: "Nothing could be extracted from the uploaded files.", warnings },
        { status: 200 },
      );
    }

    let persist;
    try {
      persist = await persistExtractionResult({ transactionId: id, storagePaths, result: combined });
    } catch (error) {
      const status = error instanceof DataAccessError ? error.status : 500;
      return Response.json({ ...toErrorPayload(error), processed, warnings }, { status });
    }

    return Response.json({
      processed,
      status: persist.status,
      mode: combined.mode,
      flags: persist.status === "saved" ? combined.health.flags.length : 0,
      error: persist.status === "failed" ? persist.error : undefined,
      warnings,
    });
  } catch (error) {
    const status = error instanceof DataAccessError ? error.status : 500;
    return Response.json(toErrorPayload(error), { status });
  }
}

function validatePdf(name: string, buffer: Buffer): string | null {
  if (buffer.length === 0) {
    return `${name} is empty (0 bytes).`;
  }
  if (buffer.length > MAX_FILE_BYTES) {
    return `${name} is larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`;
  }
  const hasPdfExtension = name.toLowerCase().endsWith(".pdf");
  const hasPdfHeader = buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  if (!hasPdfExtension || !hasPdfHeader) {
    return `${name} is not a valid PDF file.`;
  }
  return null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}
