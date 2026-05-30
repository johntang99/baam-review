import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { AuditLanguage } from "../templating/types";

const BUCKET = "audit-pdfs";
let bucketEnsured = false;

export interface StoredPdf {
  language: AuditLanguage;
  public_url: string;
  storage_path: string;
  file_size_bytes: number;
}

export async function storeAuditPdf(args: {
  pdfBuffer: Uint8Array;
  auditId: string;
  language: AuditLanguage;
}): Promise<StoredPdf> {
  const supabase = createServiceClient();
  await ensureBucket(supabase);

  const path = `${args.auditId}/${args.language}.pdf`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, args.pdfBuffer, {
    contentType: "application/pdf",
    cacheControl: "31536000",
    upsert: true,
  });

  if (error) {
    throw new Error(`audit-pdfs upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    language: args.language,
    public_url: data.publicUrl,
    storage_path: path,
    file_size_bytes: args.pdfBuffer.byteLength,
  };
}

async function ensureBucket(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  if (bucketEnsured) return;

  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) {
    bucketEnsured = true;
    return;
  }

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ["application/pdf"],
    fileSizeLimit: 10 * 1024 * 1024,
  });

  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`audit-pdfs bucket create failed: ${error.message}`);
  }

  bucketEnsured = true;
}
