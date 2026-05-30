import type { AuditCompetitorsData } from "../competitors/types";
import type { VerticalBenchmarks } from "../benchmarks/types";
import type { AuditGoogleData, Tier } from "../google/types";
import { computeRatingQuality } from "./component-rating";
import { computeReviewVolume } from "./component-volume";
import { computeVelocity } from "./component-velocity";
import { applyCriticalFloor } from "./critical-floor";
import { diagnosisForGrade, gradeFromScore } from "./grade-diagnoses";
import { findWeakestComponent } from "./weakest-component";
import type { AuditScore, ScoreComponent } from "./types";

export type { AuditScore, ScoreComponent, Grade, ComponentKey } from "./types";
export { logScoreRun } from "./score-logger";
export { gradeFromScore, diagnosisForGrade } from "./grade-diagnoses";

// Free-tier weights: only rating + volume are measurable from Place
// Details data. Google's API returns 5 reviews in non-chronological
// order, so velocity and last-review-recency can't be inferred — they
// require Outscraper's full review history (paid tier). Free-tier
// audits omit velocity rows from the display.
const FREE_TIER_WEIGHTS = {
  rating_quality: 0.5,
  review_volume: 0.5,
  velocity_30d: 0,
  velocity_180d: 0,
  velocity_365d: 0,
} as const;

export function computeAuditScore(
  google: AuditGoogleData,
  competitors: AuditCompetitorsData,
  benchmarks: VerticalBenchmarks,
): AuditScore {
  void competitors;

  const effectiveBenchmarks = applyTierWeights(benchmarks, google.meta.tier);

  const components = {
    rating_quality: computeRatingQuality(google, effectiveBenchmarks),
    review_volume: computeReviewVolume(google, effectiveBenchmarks),
    velocity_30d: computeVelocity("30d", google, effectiveBenchmarks),
    velocity_180d: computeVelocity("180d", google, effectiveBenchmarks),
    velocity_365d: computeVelocity("365d", google, effectiveBenchmarks),
  };

  const uncappedTotal = Math.round(
    components.rating_quality.weighted_contribution +
      components.review_volume.weighted_contribution +
      components.velocity_30d.weighted_contribution +
      components.velocity_180d.weighted_contribution +
      components.velocity_365d.weighted_contribution,
  );

  const floor =
    google.meta.tier === "paid"
      ? applyCriticalFloor(uncappedTotal, google)
      : { total: uncappedTotal, applied: false, reason: null };
  const total = floor.total;
  const grade = gradeFromScore(total);

  return {
    total,
    grade,
    grade_diagnosis: diagnosisForGrade(grade),
    components,
    critical_floor_applied: floor.applied,
    critical_floor_reason: floor.reason,
    uncapped_total: uncappedTotal,
    weakest_component: findWeakestComponent(measuredComponents(components)),
    benchmark_version: benchmarks.version,
    computed_at: new Date().toISOString(),
  };
}

function applyTierWeights(
  benchmarks: VerticalBenchmarks,
  tier: Tier,
): VerticalBenchmarks {
  if (tier === "paid") return benchmarks;
  return { ...benchmarks, weights: FREE_TIER_WEIGHTS };
}

function measuredComponents(
  components: AuditScore["components"],
): AuditScore["components"] {
  const filtered: Record<string, ScoreComponent> = {};
  for (const [key, comp] of Object.entries(components)) {
    if (comp.weight > 0) filtered[key] = comp;
  }
  return filtered as unknown as AuditScore["components"];
}
