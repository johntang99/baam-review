import type { Review } from "../types";

export interface ReviewAggregates {
  total_count: number;
  reviews_30d: number;
  reviews_90d: number;
  reviews_180d: number;
  reviews_365d: number;
  velocity_30d_per_month: number;
  velocity_180d_per_month: number;
  velocity_365d_per_month: number;
  last_review_date: string | null;
  last_review_days_ago: number | null;
  response_rate: number;
  unanswered_count: number;
  response_time_median_hours: number | null;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function aggregateReviews(
  reviews: Review[],
  asOf: Date = new Date(),
): ReviewAggregates {
  const total_count = reviews.length;

  if (total_count === 0) {
    return {
      total_count: 0,
      reviews_30d: 0,
      reviews_90d: 0,
      reviews_180d: 0,
      reviews_365d: 0,
      velocity_30d_per_month: 0,
      velocity_180d_per_month: 0,
      velocity_365d_per_month: 0,
      last_review_date: null,
      last_review_days_ago: null,
      response_rate: 0,
      unanswered_count: 0,
      response_time_median_hours: null,
    };
  }

  const asOfMs = asOf.getTime();
  let reviews_30d = 0;
  let reviews_90d = 0;
  let reviews_180d = 0;
  let reviews_365d = 0;
  let latestTimestampMs = 0;
  let responsesCount = 0;
  const responseTimesHours: number[] = [];

  for (const review of reviews) {
    const reviewMs = Date.parse(review.timestamp);
    if (Number.isNaN(reviewMs)) continue;

    const ageMs = asOfMs - reviewMs;
    const ageDays = ageMs / ONE_DAY_MS;

    if (ageDays <= 30) reviews_30d++;
    if (ageDays <= 90) reviews_90d++;
    if (ageDays <= 180) reviews_180d++;
    if (ageDays <= 365) reviews_365d++;

    if (reviewMs > latestTimestampMs) latestTimestampMs = reviewMs;

    if (review.has_owner_response) {
      responsesCount++;
      if (typeof review.owner_response_time_hours === "number") {
        responseTimesHours.push(review.owner_response_time_hours);
      }
    }
  }

  const last_review_date =
    latestTimestampMs > 0 ? new Date(latestTimestampMs).toISOString() : null;
  const last_review_days_ago =
    latestTimestampMs > 0
      ? Math.floor((asOfMs - latestTimestampMs) / ONE_DAY_MS)
      : null;

  return {
    total_count,
    reviews_30d,
    reviews_90d,
    reviews_180d,
    reviews_365d,
    velocity_30d_per_month: reviews_30d,
    velocity_180d_per_month: reviews_180d / 6,
    velocity_365d_per_month: reviews_365d / 12,
    last_review_date,
    last_review_days_ago,
    response_rate: responsesCount / total_count,
    unanswered_count: total_count - responsesCount,
    response_time_median_hours: median(responseTimesHours),
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
