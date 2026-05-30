import {
  scoreFromRating,
  scoreFromVelocity,
  scoreFromVolume,
} from "../benchmarks";
import type { VerticalBenchmarks } from "../benchmarks/types";
import type { AuditGoogleData } from "../google/types";
import { projectVelocityCount } from "./velocity-decay";

const FLOOR_CAP = 49;

export function projectDoNothingScore(
  t: number,
  google: AuditGoogleData,
  benchmarks: VerticalBenchmarks,
): number {
  const reviews_30d = google.reviews_aggregate.reviews_30d ?? 0;
  const reviews_180d = google.reviews_aggregate.reviews_180d ?? 0;
  const reviews_365d = google.reviews_aggregate.reviews_365d ?? 0;

  const projectedReviews30d = projectVelocityCount(reviews_30d, 30, t);
  const projectedReviews180d = projectVelocityCount(reviews_180d, 180, t);
  const projectedReviews365d = projectVelocityCount(reviews_365d, 365, t);

  const projectedVelocity30d = projectedReviews30d;
  const projectedVelocity180d = projectedReviews180d / 6;
  const projectedVelocity365d = projectedReviews365d / 12;

  const ratingScore = scoreFromRating(
    google.reviews_aggregate.rating,
    benchmarks.rubric.rating,
  );
  const volumeScore = scoreFromVolume(
    google.reviews_aggregate.total_count,
    benchmarks.rubric.volume,
  );
  const v30Score = scoreFromVelocity(
    projectedVelocity30d,
    benchmarks.rubric.velocity,
  );
  const v180Score = scoreFromVelocity(
    projectedVelocity180d,
    benchmarks.rubric.velocity,
  );
  const v365Score = scoreFromVelocity(
    projectedVelocity365d,
    benchmarks.rubric.velocity,
  );

  const weighted =
    ratingScore * benchmarks.weights.rating_quality +
    volumeScore * benchmarks.weights.review_volume +
    v30Score * benchmarks.weights.velocity_30d +
    v180Score * benchmarks.weights.velocity_180d +
    v365Score * benchmarks.weights.velocity_365d;

  const lastReviewDaysAgoProjected =
    (google.reviews_aggregate.last_review_days_ago ?? 0) + t * 30;
  if (projectedVelocity30d === 0 && lastReviewDaysAgoProjected > 60) {
    return Math.min(Math.round(weighted), FLOOR_CAP);
  }

  return Math.round(weighted);
}
