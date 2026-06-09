export type UploadResponse = {
  processed?: number;
  status?: "saved" | "failed";
  mode?: "openai" | "anthropic" | "failed";
  flags?: number;
  warnings?: string[];
  error?: string;
  hint?: string;
};

export function buildUploadStatusMessage(data: UploadResponse) {
  const processed = data.processed ?? 0;
  const flags = data.flags ?? 0;
  return `Processed ${processed} file(s) and saved ${flags} review flag(s).`;
}

export async function readUploadResponse(response: Response): Promise<UploadResponse> {
  const text = await response.text();
  const trimmed = text.trim();

  if (!trimmed) {
    return { error: `Upload failed with status ${response.status}.` };
  }

  try {
    return JSON.parse(trimmed) as UploadResponse;
  } catch {
    return { error: trimmed };
  }
}
