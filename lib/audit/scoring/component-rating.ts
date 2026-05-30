import { buildRatingAnchors, scoreFromRating } from "../benchmarks";
import type { VerticalBenchmarks } from "../benchmarks/types";
import type { AuditGoogleData } from "../google/types";
import type { ScoreComponent } from "./types";

export function computeRatingQuality(
  google: AuditGoogleData,
  benchmarks: VerticalBenchmarks,
): ScoreComponent {
  const compositeRating = google.reviews_aggregate.rating;
  const score = scoreFromRating(compositeRating, benchmarks.rubric.rating);
  const weight = benchmarks.weights.rating_quality;

  return {
    raw_score: roundScore(score),
    weight,
    weighted_contribution: score * weight,
    measured_value: compositeRating,
    measured_value_label: `composite ${compositeRating.toFixed(2)}★`,
    measured_value_calculation: null,
    rubric_anchors: buildRatingAnchors(benchmarks),
  };
}

function roundScore(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)));
}
