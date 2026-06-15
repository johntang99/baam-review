import "server-only";
import { randomUUID } from "node:crypto";
import type { AuditCompetitorsData } from "../competitors/types";
import type { AuditGoogleData } from "../google/types";
import type { AuditProjection } from "../projection/types";
import type { AuditScore } from "../scoring/types";
import type { VerticalBenchmarks } from "../benchmarks/types";
import { renderAuditPdf } from "../templating";
import type { AuditLanguage } from "../templating/types";

type RenderedPdf = Awaited<ReturnType<typeof renderAuditPdf>>;
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
  /** Override the generated UUID. Used by async generation to reuse the
   * pending audit row created by startAuditGeneration. */
  audit_id?: string;
  /** Optional secondary-platform data (Yelp, etc) — surfaced in Section 2. */
  platforms?: import("../platforms/types").AuditPlatformsData;
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
  const auditId = input.audit_id ?? randomUUID();
  const languages = decideLanguages(input.google, input.force_language);

  const sharedInput = {
    google: input.google,
    competitors: input.competitors,
    score: input.score,
    projection: input.projection,
    benchmarks: input.benchmarks,
    platforms: input.platforms,
    tier: input.google.meta.tier,
    audit_id: auditId,
  };

  // PDF pre-rendering is best-effort and MUST NOT fail the whole audit. The
  // report is viewable as HTML (the /audit/<id> embed) and PDFs are also
  // rendered on-demand at download time, so a transient Chromium hiccup (e.g.
  // spawn ETXTBSY) should still produce a complete, viewable audit. We render
  // each language independently and keep whatever succeeds.
  const rendered = (
    await Promise.all(
      languages.map(async (language) => {
        try {
          const result = await renderAuditPdf({ ...sharedInput, language });
          return { language, result };
        } catch (e) {
          console.error(
            `[delivery] PDF render failed for ${language} (non-fatal):`,
            e instanceof Error ? e.message : e,
          );
          return null;
        }
      }),
    )
  ).filter((r): r is { language: AuditLanguage; result: RenderedPdf } => r !== null);

  const stored: StoredPdf[] = [];
  if (input.store_pdf !== false) {
    for (const r of rendered) {
      try {
        const s = await storeAuditPdf({
          pdfBuffer: r.result.pdf_buffer,
          auditId,
          language: r.language,
        });
        stored.push(s);
      } catch (e) {
        console.error(
          `[delivery] PDF store failed for ${r.language} (non-fatal):`,
          e instanceof Error ? e.message : e,
        );
      }
    }
  }

  // Pair stored PDFs back to their render by language (a render may have
  // succeeded without a successful store, and vice-versa is impossible).
  const bufByLang = new Map(rendered.map((r) => [r.language, r.result]));
  const storedByLang = new Map(stored.map((s) => [s.language, s]));

  let email_sent = false;
  let email_message_id: string | undefined;
  let email_error: string | undefined;

  // Only attach PDFs that both rendered AND stored. If none, the email still
  // sends with the dashboard link.
  const emailPdfs = stored
    .map((s) => {
      const r = bufByLang.get(s.language);
      return r ? { ...s, pdf_buffer: r.pdf_buffer } : null;
    })
    .filter((p): p is StoredPdf & { pdf_buffer: Uint8Array } => p !== null);

  if (input.send_email && input.customer?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://baamreview.com";
    const result = await sendAuditEmail({
      to: input.customer.email,
      recipient_name: input.customer.name,
      business_name: input.google.business.name,
      audit_id: auditId,
      total_score: input.score.total,
      grade: input.score.grade,
      grade_diagnosis: input.score.grade_diagnosis,
      dashboard_url: `${appUrl}/audit/${auditId}`,
      pdfs: emailPdfs,
    });
    email_sent = result.sent;
    email_message_id = result.message_id;
    email_error = result.error;
  }

  // Write the audit record even when NO PDF stored — the audit must still be a
  // complete, viewable record (HTML embed + on-demand PDF download). Without
  // this, a transient Chromium failure would lose the whole audit.
  let audit_record_written = false;
  if (input.write_audit_record !== false) {
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
    pdfs: rendered.map((r) => ({
      language: r.language,
      public_url: storedByLang.get(r.language)?.public_url,
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
