import "server-only";
import { buildAuditViewModel } from "./data-mapper";
import { renderAuditHtml } from "./html-renderer";
import { renderHtmlToPdf } from "./pdf-renderer";
import type { RenderAuditInput, RenderAuditOutput } from "./types";

export type {
  AuditViewModel,
  RenderAuditInput,
  RenderAuditOutput,
} from "./types";

export { buildAuditViewModel } from "./data-mapper";
export { renderAuditHtml } from "./html-renderer";

export async function renderAuditPdf(
  input: RenderAuditInput,
): Promise<RenderAuditOutput> {
  const view = buildAuditViewModel(input);
  const html = renderAuditHtml(view);
  const pdf = await renderHtmlToPdf(html);

  return {
    pdf_buffer: pdf.pdf_buffer,
    page_count: pdf.page_count,
    generation_time_ms: pdf.generation_time_ms,
    language: view.language,
  };
}
