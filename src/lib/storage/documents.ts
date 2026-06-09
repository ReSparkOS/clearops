import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { getServerSupabaseConfig, isSupabaseAdminConfigured } from "@/lib/env";

export type StoredUpload = {
  bucket: string;
  path: string;
};

export async function storePacketDocument(input: {
  transactionId: string;
  filename: string;
  contentType: string;
  fileBuffer: Buffer;
}): Promise<StoredUpload | null> {
  if (!isSupabaseAdminConfigured()) {
    return null;
  }

  const { storageBucket } = getServerSupabaseConfig();
  const supabase = createAdminClient();
  const path = `${input.transactionId}/${Date.now()}-${randomUUID()}-${sanitizeFilename(input.filename)}`;
  const { error } = await supabase.storage.from(storageBucket).upload(path, input.fileBuffer, {
    contentType: input.contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  return {
    bucket: storageBucket,
    path,
  };
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120);
}
