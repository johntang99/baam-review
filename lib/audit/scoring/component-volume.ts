import { buildVolumeAnchors, scoreFromVolume } from "../benchmarks";
import type { VerticalBenchmarks } from "../benchmarks/types";
import type { AuditGoogleData } from "../google/types";
import type { ScoreComponent } from "./types";

export function computeReviewVolume(
  google: AuditGoogleData,
  benchmarks: VerticalBenchmarks,
): ScoreComponent {
  const count = google.reviews_aggregate.total_count;
  const score = scoreFromVolume(count, benchmarks.rubric.volume);
  const weight = benchmarks.weights.review_volume;

  return {
    raw_score: roundScore(score),
    weight,
    weighted_contribution: score * weight,
    measured_value: count,
    measured_value_label: `${count} total review${count === 1 ? "" : "s"}`,
    measured_value_calculation: null,
    rubric_anchors: buildVolumeAnchors(benchmarks),
  };
}

function roundScore(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)));
}
