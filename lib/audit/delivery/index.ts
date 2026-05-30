import "server-only";
import { randomUUID } from "node:crypto";
import type { AuditCompetitorsData } from "../competitors/types";
import type { AuditGoogleData } from "../google/types";
import type { AuditProjection } from "../projection/types";
import type { AuditScore } from "../scoring/types";
import type { VerticalBenchmarks } from "../benchmarks/types";
import { renderAuditPdf } from "../templating";
import type { AuditLanguage } from "../templating/types";
import { decideLanguages } from "./language-router";
import { storeAuditPdf, type StoredPdf } from "./pdf-storage";
import { sendAuditEmail } from "./email-sender";
import { writeAuditRecord } from "./audit-record-writer";
import { logScoreRun } from "../scoring/score-logger";

export interface DeliverAuditInput {
  google: AuditGoogleData;
  competitors: AuditCompetitorsData;
  score: AuditScore;
  projection: AuditProjection;
  benchmarks: VerticalBenchmarks;

  customer?: {
    user_id?: string;
    email: string;
    name?: string;
  };

  force_language?: AuditLanguage | "both";
  send_email?: boolean;
  store_pdf?: boolean;
  write_audit_record?: boolean;
}

export interface DeliverAuditOutput {
  audit_id: string;
  languages_rendered: AuditLanguage[];
  pdfs: Array<{
    language: AuditLanguage;
    public_url?: string;
    file_size_bytes: number;
    page_count: number;
    pdf_buffer: Uint8Array;
  }>;
  email_sent: boolean;
  email_message_id?: string;
  email_error?: string;
  generation_time_ms: number;
  audit_record_written: boolean;
}

export async function renderAndDeliverAudit(
  input: DeliverAuditInput,
): Promise<DeliverAuditOutput> {
  const t0 = Date.now();
  const auditId = randomUUID();
  const languages = decideLanguages(input.google, input.force_language);

  const sharedInput = {
    google: input.google,
    competitors: input.competitors,
    score: input.score,
    projection: input.projection,
    benchmarks: input.benchmarks,
    tier: input.google.meta.tier,
    audit_id: auditId,
  };

  const rendered = await Promise.all(
    languages.map(async (language) => {
      const result = await renderAuditPdf({ ...sharedInput, language });
      return { language, result };
    }),
  );

  const stored: StoredPdf[] = [];
  if (input.store_pdf !== false) {
    for (const r of rendered) {
      const s = await storeAuditPdf({
        pdfBuffer: r.result.pdf_buffer,
        auditId,
        language: r.language,
      });
      stored.push(s);
    }
  }

  let email_sent = false;
  let email_message_id: string | undefined;
  let email_error: string | undefined;

  if (input.send_email && input.customer?.email) {
    const result = await sendAuditEmail({
      to: input.customer.email,
      recipient_name: input.customer.name,
      business_name: input.google.business.name,
      audit_id: auditId,
      total_score: input.score.total,
      grade: input.score.grade,
      pdfs: rendered.map((r, i) => ({
        ...stored[i],
        pdf_buffer: r.result.pdf_buffer,
      })),
    });
    email_sent = result.sent;
    email_message_id = result.message_id;
    email_error = result.error;
  }

  let audit_record_written = false;
  if (input.write_audit_record !== false && stored.length > 0) {
    try {
      await writeAuditRecord({
        audit_id: auditId,
        user_id: input.customer?.user_id,
        google: input.google,
        competitors: input.competitors,
        score: input.score,
        projection: input.projection,
        benchmarks: input.benchmarks,
        languages_rendered: languages,
        pdfs: stored,
        email_sent,
        email_message_id,
        generation_time_ms: Date.now() - t0,
      });
      audit_record_written = true;
    } catch (e) {
      console.error("[delivery] audit record write failed:", e);
    }
  }

  await logScoreRun(input.google, input.benchmarks, input.score).catch(() => {});

  return {
    audit_id: auditId,
    languages_rendered: languages,
    pdfs: rendered.map((r, i) => ({
      language: r.language,
      public_url: stored[i]?.public_url,
      file_size_bytes: r.result.pdf_buffer.byteLength,
      page_count: r.result.page_count,
      pdf_buffer: r.result.pdf_buffer,
    })),
    email_sent,
    email_message_id,
    email_error,
    generation_time_ms: Date.now() - t0,
    audit_record_written,
  };
}

export { decideLanguages } from "./language-router";
export { storeAuditPdf } from "./pdf-storage";
export { sendAuditEmail } from "./email-sender";
export { writeAuditRecord } from "./audit-record-writer";
