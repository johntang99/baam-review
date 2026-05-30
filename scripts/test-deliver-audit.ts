import { getGoogleBusinessData } from "@/lib/audit/google";
import { getCompetitorsData } from "@/lib/audit/competitors";
import { getBenchmarksForBusiness } from "@/lib/audit/benchmarks";
import { computeAuditScore } from "@/lib/audit/scoring";
import { computeProjection } from "@/lib/audit/projection";
import { renderAndDeliverAudit } from "@/lib/audit/delivery";

(async () => {
  const placeId = process.argv[2] ?? "ChIJedSLGABhwokRFeP5JVIZOSM";
  const tier = (process.argv[3] ?? "paid") as "free" | "paid";
  const email = process.argv[4];

  console.log(`>> Deliver test: placeId=${placeId} tier=${tier}${email ? ` email=${email}` : " (skip email)"}\n`);

  const google = await getGoogleBusinessData({ placeId }, tier);
  const competitors = await getCompetitorsData(google, tier);
  const benchmarks = await getBenchmarksForBusiness(google);
  const score = computeAuditScore(google, competitors, benchmarks);
  const projection = computeProjection(google, competitors, score, benchmarks);

  const result = await renderAndDeliverAudit({
    google,
    competitors,
    score,
    projection,
    benchmarks,
    customer: email ? { email, name: undefined } : undefined,
    send_email: !!email,
  });

  console.log(`audit_id: ${result.audit_id}`);
  console.log(`languages: ${result.languages_rendered.join(", ")}`);
  console.log(`PDFs (${result.pdfs.length}):`);
  for (const pdf of result.pdfs) {
    console.log(`  ${pdf.language}  ${(pdf.file_size_bytes / 1024).toFixed(1)} KB  ${pdf.page_count} pages`);
    console.log(`    ${pdf.public_url ?? "(not stored)"}`);
  }
  console.log(`audit_record_written: ${result.audit_record_written}`);
  console.log(`email_sent: ${result.email_sent}${result.email_message_id ? ` (id=${result.email_message_id})` : ""}`);
  if (result.email_error) console.log(`email_error: ${result.email_error}`);
  console.log(`total time: ${result.generation_time_ms}ms`);
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
