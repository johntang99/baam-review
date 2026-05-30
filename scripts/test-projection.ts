import { getGoogleBusinessData } from "@/lib/audit/google";
import { getCompetitorsData } from "@/lib/audit/competitors";
import { getBenchmarksForBusiness } from "@/lib/audit/benchmarks";
import { computeAuditScore } from "@/lib/audit/scoring";
import { computeProjection } from "@/lib/audit/projection";

(async () => {
  const placeId = process.argv[2] ?? "ChIJedSLGABhwokRFeP5JVIZOSM";
  const tier = (process.argv[3] ?? "paid") as "free" | "paid";

  console.log(`>> Projection test: placeId=${placeId} tier=${tier}\n`);

  const primary = await getGoogleBusinessData({ placeId }, tier);
  const competitors = await getCompetitorsData(primary, tier);
  const benchmarks = await getBenchmarksForBusiness(primary);
  const score = computeAuditScore(primary, competitors, benchmarks);

  const t0 = Date.now();
  const projection = computeProjection(primary, competitors, score, benchmarks);
  const ms = Date.now() - t0;

  console.log(`${primary.business.name} | current ${score.total}/${score.grade}`);
  console.log(`competitor avg velocity: ${projection.parameters_used.competitor_avg_velocity.toFixed(2)}/mo`);
  console.log(`projection computed in ${ms}ms\n`);

  console.log("Timeline (do-nothing | with-baam):");
  for (const p of projection.timeline) {
    const dn = `${String(p.do_nothing_score).padStart(3)}/${p.do_nothing_grade}`;
    const wb = `${String(p.with_baam_score).padStart(3)}/${p.with_baam_grade}`;
    const bar = renderBar(p.do_nothing_score, p.with_baam_score);
    console.log(`  M${String(p.month).padStart(2)}  ${dn}    ${wb}    ${bar}`);
  }

  console.log(`\nSix-month milestone:`);
  console.log(`  do-nothing: ${projection.six_month.do_nothing_score}/${projection.six_month.do_nothing_grade}`);
  console.log(`  with-baam : ${projection.six_month.with_baam_score}/${projection.six_month.with_baam_grade}`);
  console.log(`  gap: ${projection.six_month.score_gap > 0 ? "+" : ""}${projection.six_month.score_gap}`);

  console.log(`\nTwelve-month milestone:`);
  console.log(`  do-nothing: ${projection.twelve_month.do_nothing_score}/${projection.twelve_month.do_nothing_grade}`);
  console.log(`  with-baam : ${projection.twelve_month.with_baam_score}/${projection.twelve_month.with_baam_grade}`);

  console.log(`\nRevenue impact:`);
  console.log(`  6-month loss : $${projection.revenue_impact.six_month_loss_usd.toLocaleString()}`);
  console.log(`  12-month loss: $${projection.revenue_impact.twelve_month_loss_usd.toLocaleString()}`);
  console.log(`  monthly run-rate: $${projection.revenue_impact.monthly_loss_run_rate_usd.toLocaleString()}/mo`);
  console.log(`  competitor advantage: ${projection.revenue_impact.competitor_velocity_advantage.toFixed(2)}/mo`);
  console.log(`  per-review value: $${projection.revenue_impact.per_review_value_used}`);

  console.log(`\nRanking estimate (${projection.ranking_estimate.confidence}):`);
  console.log(`  current: #${projection.ranking_estimate.current_position}`);
  console.log(`  6-month do-nothing: #${projection.ranking_estimate.do_nothing_six_month_position} (drop ${projection.ranking_estimate.do_nothing_six_month_drop})`);
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});

function renderBar(dn: number, wb: number): string {
  const width = 40;
  const cells: string[] = [];
  for (let i = 0; i < width; i++) {
    const pos = (i / width) * 100;
    if (pos < Math.min(dn, wb)) cells.push("█");
    else if (pos < wb) cells.push("▓");
    else if (pos < dn) cells.push("░");
    else cells.push(" ");
  }
  return cells.join("");
}
