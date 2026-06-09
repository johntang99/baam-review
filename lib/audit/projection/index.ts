import type { AuditCompetitorsData } from "../competitors/types";
import type { VerticalBenchmarks } from "../benchmarks/types";
import type { AuditGoogleData } from "../google/types";
import type { AuditScore } from "../scoring/types";
import { gradeFromScore } from "../scoring/grade-diagnoses";
import { projectDoNothingScore } from "./do-nothing-projector";
import { projectWithBaamScore } from "./with-baam-projector";
import { computeRevenueImpact } from "./revenue-impact";
import { estimateRanking } from "./ranking-estimator";
import type { AuditProjection, ProjectionPoint } from "./types";

export type { AuditProjection, ProjectionPoint } from "./types";

export function computeProjection(
  google: AuditGoogleData,
  competitors: AuditCompetitorsData,
  currentScore: AuditScore,
  benchmarks: VerticalBenchmarks,
): AuditProjection {
  const timeline: ProjectionPoint[] = [];
  // The "with BAAM" line never drops below today's score and never decreases
  // month-over-month — the service holds or improves a business, it does not
  // make it worse. Capped at 100.
  let withBaamFloor = currentScore.total;
  for (let month = 0; month <= 12; month++) {
    const do_nothing_score =
      month === 0
        ? currentScore.total
        : projectDoNothingScore(month, google, benchmarks);
    const with_baam_score =
      month === 0
        ? currentScore.total
        : Math.min(
            100,
            Math.max(withBaamFloor, projectWithBaamScore(month, google, benchmarks)),
          );
    withBaamFloor = with_baam_score;

    timeline.push({
      month,
      do_nothing_score,
      with_baam_score,
      do_nothing_grade: gradeFromScore(do_nothing_score),
      with_baam_grade: gradeFromScore(with_baam_score),
    });
  }

  const sixMonth = timeline[6];
  const twelveMonth = timeline[12];

  return {
    timeline,
    six_month: {
      do_nothing_score: sixMonth.do_nothing_score,
      do_nothing_grade: sixMonth.do_nothing_grade,
      with_baam_score: sixMonth.with_baam_score,
      with_baam_grade: sixMonth.with_baam_grade,
      score_gap: sixMonth.with_baam_score - sixMonth.do_nothing_score,
    },
    twelve_month: {
      do_nothing_score: twelveMonth.do_nothing_score,
      do_nothing_grade: twelveMonth.do_nothing_grade,
      with_baam_score: twelveMonth.with_baam_score,
      with_baam_grade: twelveMonth.with_baam_grade,
    },
    revenue_impact: computeRevenueImpact(google, competitors, benchmarks),
    ranking_estimate: estimateRanking(google, competitors, benchmarks),
    parameters_used: {
      velocity_decay_model: "linear_window_drop",
      ranking_slide_onset_weeks:
        benchmarks.projection?.ranking_slide_onset_weeks ?? 3,
      velocity_half_life_days:
        benchmarks.projection?.velocity_half_life_days ?? 90,
      competitor_avg_velocity:
        competitors.competitor_aggregate.avg_velocity_30d_per_month ?? 0,
      benchmark_version: benchmarks.version,
    },
    computed_at: new Date().toISOString(),
  };
}
