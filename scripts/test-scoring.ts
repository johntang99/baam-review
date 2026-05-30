import { getGoogleBusinessData } from "@/lib/audit/google";
import { getCompetitorsData } from "@/lib/audit/competitors";
import { getBenchmarksForBusiness } from "@/lib/audit/benchmarks";
import { computeAuditScore, logScoreRun } from "@/lib/audit/scoring";

(async () => {
  const placeId = process.argv[2] ?? "ChIJedSLGABhwokRFeP5JVIZOSM";
  const tier = (process.argv[3] ?? "paid") as "free" | "paid";

  console.log(`>> Pipeline test: placeId=${placeId} tier=${tier}\n`);

  const t0 = Date.now();
  const primary = await getGoogleBusinessData(
    { placeId, forceRefresh: true },
    tier,
  );
  const tGoogle = Date.now() - t0;

  console.log(`[1/4] Google data: ${primary.business.name}`);
  console.log(`      ${primary.reviews_aggregate.total_count} reviews | ${primary.reviews_aggregate.rating}★ | vertical=${primary.vertical.inferred_vertical}`);
  console.log(`      city=${primary.business.city} zip=${primary.business.zip} (${tGoogle}ms)\n`);

  const t1 = Date.now();
  const competitors = await getCompetitorsData(primary, tier);
  const tComp = Date.now() - t1;

  console.log(`[2/4] Competitors: ${competitors.competitors.length} found (${tComp}ms)`);
  console.log(`      avg_velocity_30d=${competitors.competitor_aggregate.avg_velocity_30d_per_month?.toFixed(2) ?? "null"}`);
  console.log(`      velocity_gap=${competitors.competitor_aggregate.velocity_gap_vs_primary?.toFixed(2) ?? "null"}\n`);

  const t2 = Date.now();
  const benchmarks = await getBenchmarksForBusiness(primary);
  const tBench = Date.now() - t2;

  console.log(`[3/4] Benchmarks: ${benchmarks.vertical} / ${benchmarks.region} v${benchmarks.version} (${tBench}ms)\n`);

  const t3 = Date.now();
  const score = computeAuditScore(primary, competitors, benchmarks);
  const tScore = Date.now() - t3;

  console.log(`[4/4] Score computed in ${tScore}ms`);
  console.log(`      TOTAL: ${score.total} | GRADE: ${score.grade}`);
  console.log(`      ${score.grade_diagnosis}\n`);

  if (score.critical_floor_applied) {
    console.log(`      ⚠ Critical floor applied: ${score.critical_floor_reason}`);
    console.log(`      uncapped would be: ${score.uncapped_total}\n`);
  }

  console.log("Components:");
  for (const [key, c] of Object.entries(score.components)) {
    const flag = key === score.weakest_component ? " ← weakest" : "";
    console.log(
      `  ${key.padEnd(18)} score=${String(c.raw_score).padStart(3)} × ${(c.weight * 100).toFixed(0)}% = ${c.weighted_contribution.toFixed(2)}  ${c.measured_value_label}${flag}`,
    );
  }

  console.log("\nAnchors for 30d velocity bar:");
  for (const a of score.components.velocity_30d.rubric_anchors) {
    console.log(`  ${a.is_key ? "[KEY]" : "     "} ${a.label.padEnd(20)} (value=${a.value}, score=${a.score})`);
  }

  await logScoreRun(primary, benchmarks, score);
  console.log("\nLogged to audit_score_runs.");

  console.log(`\nTotal pipeline time: ${Date.now() - t0}ms`);
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
