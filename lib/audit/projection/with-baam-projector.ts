import {
  scoreFromRating,
  scoreFromVelocity,
  scoreFromVolume,
} from "../benchmarks";
import type { VerticalBenchmarks } from "../benchmarks/types";
import type { AuditGoogleData } from "../google/types";

const RATING_GAIN_PER_QUARTER = 0.05;
const RATING_CAP = 4.9;

export function projectWithBaamScore(
  t: number,
  google: AuditGoogleData,
  benchmarks: VerticalBenchmarks,
): number {
  const targetVelocity = benchmarks.healthy_velocity.optimal_low_per_month;
  const rampMonths = benchmarks.projection?.ramp_months_with_baam ?? 3;
  const newReviewsPerMonth = Math.min(
    targetVelocity,
    (t / rampMonths) * targetVelocity,
  );

  const totalNewReviews = newReviewsPerMonth * t;

  const currentVelocity30d =
    google.reviews_aggregate.velocity_30d_per_month ?? 0;
  const projectedVelocity30d =
    t === 0 ? currentVelocity30d : newReviewsPerMonth;

  const reviews180dStart = google.reviews_aggregate.reviews_180d ?? 0;
  const reviews365dStart = google.reviews_aggregate.reviews_365d ?? 0;

  const monthsInWindow180 = Math.min(180 / 30, t);
  const monthsInWindow365 = Math.min(365 / 30, t);

  const projectedReviews180d =
    monthsInWindow180 * newReviewsPerMonth +
    reviews180dStart * Math.max(0, (180 - t * 30) / 180);
  const projectedReviews365d =
    monthsInWindow365 * newReviewsPerMonth +
    reviews365dStart * Math.max(0, (365 - t * 30) / 365);

  const projectedVelocity180d = projectedReviews180d / 6;
  const projectedVelocity365d = projectedReviews365d / 12;

  const projectedTotalCount =
    google.reviews_aggregate.total_count + totalNewReviews;

  const projectedRating = Math.min(
    RATING_CAP,
    google.reviews_aggregate.rating + (t / 3) * RATING_GAIN_PER_QUARTER,
  );

  const ratingScore = scoreFromRating(projectedRating, benchmarks.rubric.rating);
  const volumeScore = scoreFromVolume(
    projectedTotalCount,
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

  return Math.round(weighted);
}
