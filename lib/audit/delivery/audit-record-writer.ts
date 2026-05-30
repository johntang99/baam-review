import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { AuditCompetitorsData } from "../competitors/types";
import type { AuditGoogleData } from "../google/types";
import type { AuditProjection } from "../projection/types";
import type { AuditScore } from "../scoring/types";
import type { VerticalBenchmarks } from "../benchmarks/types";
import type { AuditLanguage } from "../templating/types";
import type { StoredPdf } from "./pdf-storage";

const TABLE = "audits";

export interface AuditRecordInput {
  audit_id: string;
  user_id?: string;
  google: AuditGoogleData;
  competitors: AuditCompetitorsData;
  score: AuditScore;
  projection: AuditProjection;
  benchmarks: VerticalBenchmarks;
  languages_rendered: AuditLanguage[];
  pdfs: StoredPdf[];
  email_sent: boolean;
  email_message_id?: string;
  generation_time_ms: number;
}

export async function writeAuditRecord(
  input: AuditRecordInput,
): Promise<void> {
  const supabase = createServiceClient();

  const pdfUrlsByLang: Record<string, string> = {};
  for (const pdf of input.pdfs) {
    pdfUrlsByLang[pdf.language] = pdf.public_url;
  }

  const row = {
    id: input.audit_id,
    user_id: input.user_id ?? null,
    business_place_id: input.google.business.place_id,
    vertical: input.google.vertical.inferred_vertical,
    region: input.benchmarks.region,
    tier: input.google.meta.tier,
    total_score: input.score.total,
    grade: input.score.grade,
    benchmark_version: input.benchmarks.version,
    languages_rendered: input.languages_rendered,
    pdf_urls: pdfUrlsByLang,
    email_sent: input.email_sent,
    email_message_id: input.email_message_id ?? null,
    email_sent_at: input.email_sent ? new Date().toISOString() : null,
    google_data: input.google,
    competitors_data: input.competitors,
    score_data: input.score,
    projection_data: input.projection,
    generation_time_ms: input.generation_time_ms,
  };

  const { error } = await (supabase as unknown as {
    from: (t: string) => {
      upsert: (
        row: unknown,
        options: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
  })
    .from(TABLE)
    .upsert(row, { onConflict: "id" });

  if (error) {
    throw new Error(`audits insert failed: ${error.message}`);
  }
}
