import fs from "node:fs";
import path from "node:path";
import { getGoogleBusinessData } from "@/lib/audit/google";
import { getCompetitorsData } from "@/lib/audit/competitors";
import { getBenchmarksForBusiness } from "@/lib/audit/benchmarks";
import { computeAuditScore } from "@/lib/audit/scoring";
import { computeProjection } from "@/lib/audit/projection";
import { renderAuditPdf, renderAuditHtml, buildAuditViewModel } from "@/lib/audit/templating";

(async () => {
  const placeId = process.argv[2] ?? "ChIJedSLGABhwokRFeP5JVIZOSM";
  const tier = (process.argv[3] ?? "free") as "free" | "paid";
  const language = (process.argv[4] ?? "en") as "en" | "zh";

  console.log(`>> Rendering audit: placeId=${placeId} tier=${tier}`);

  const t0 = Date.now();

  const google = await getGoogleBusinessData({ placeId }, tier);
  const competitors = await getCompetitorsData(google, tier);
  const benchmarks = await getBenchmarksForBusiness(google);
  const score = computeAuditScore(google, competitors, benchmarks);
  const projection = computeProjection(google, competitors, score, benchmarks);

  console.log(`Data ready: ${google.business.name} | ${score.total}/${score.grade}`);

  const input = { google, competitors, score, projection, benchmarks, tier, language };

  const view = buildAuditViewModel(input);
  const html = renderAuditHtml(view);

  const outDir = path.join(process.cwd(), "audit/output");
  fs.mkdirSync(outDir, { recursive: true });

  const htmlPath = path.join(outDir, `${view.audit_id}-${tier}-${language}.html`);
  fs.writeFileSync(htmlPath, html);
  console.log(`HTML: ${htmlPath} (${(html.length / 1024).toFixed(1)} KB)`);

  const pdf = await renderAuditPdf(input);
  const pdfPath = path.join(outDir, `${view.audit_id}-${tier}-${language}.pdf`);
  fs.writeFileSync(pdfPath, pdf.pdf_buffer);

  console.log(`PDF: ${pdfPath} (${(pdf.pdf_buffer.byteLength / 1024).toFixed(1)} KB, ${pdf.page_count} pages, ${pdf.generation_time_ms}ms)`);
  console.log(`Total pipeline time: ${Date.now() - t0}ms`);
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
