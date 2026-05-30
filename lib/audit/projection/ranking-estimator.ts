import type { AuditCompetitorsData } from "../competitors/types";
import type { VerticalBenchmarks } from "../benchmarks/types";
import type { AuditGoogleData } from "../google/types";
import type { AuditProjection } from "./types";

const MAX_POSITION = 20;
const POSITION_LOSS_FACTOR = 0.15;
const MAX_POSITIONS_LOST = 7;

export function estimateRanking(
  google: AuditGoogleData,
  competitors: AuditCompetitorsData,
  benchmarks: VerticalBenchmarks,
): AuditProjection["ranking_estimate"] {
  const currentPosition = estimateCurrentPosition(google, competitors);

  const slideOnsetWeeks =
    benchmarks.projection?.ranking_slide_onset_weeks ?? 3;
  const competitorAvg =
    competitors.competitor_aggregate.avg_velocity_30d_per_month ?? 0;
  const primaryVelocity = google.reviews_aggregate.velocity_30d_per_month ?? 0;

  const positionsLost = projectPositionsLost({
    monthsForward: 6,
    competitorAvgVelocity: competitorAvg,
    primaryVelocity: 0,
    slideOnsetWeeks,
  });

  const sixMonthPosition = Math.min(
    MAX_POSITION,
    currentPosition + positionsLost,
  );

  const confidence = deriveConfidence(competitors, primaryVelocity, competitorAvg);

  return {
    current_position: currentPosition,
    do_nothing_six_month_position: sixMonthPosition,
    do_nothing_six_month_drop: -positionsLost,
    confidence,
    method:
      "Heuristic: current position estimated from competitor rank order; " +
      "do-nothing 6-month drop applies Sterling Sky onset (weeks of silence to ranking slide) " +
      "with a 0.15 positions-lost-per-velocity-gap-per-month factor.",
  };
}

function estimateCurrentPosition(
  google: AuditGoogleData,
  competitors: AuditCompetitorsData,
): number {
  if (competitors.competitors.length === 0) return 1;

  const primaryReviewCount = google.reviews_aggregate.total_count;
  const primaryRating = google.reviews_aggregate.rating;

  let rank = 1;
  for (const c of competitors.competitors) {
    const cReviews = c.google.reviews_aggregate.total_count;
    const cRating = c.google.reviews_aggregate.rating;

    if (cRating > primaryRating + 0.1) rank++;
    else if (cReviews > primaryReviewCount * 1.5) rank++;
  }

  return Math.min(MAX_POSITION, rank);
}

function projectPositionsLost(args: {
  monthsForward: number;
  competitorAvgVelocity: number;
  primaryVelocity: number;
  slideOnsetWeeks: number;
}): number {
  const monthsSinceSlideStart =
    args.monthsForward - args.slideOnsetWeeks / 4.3;
  if (monthsSinceSlideStart <= 0) return 0;

  const velocityGap = Math.max(
    0,
    args.competitorAvgVelocity - args.primaryVelocity,
  );
  const lost = velocityGap * monthsSinceSlideStart * POSITION_LOSS_FACTOR;

  return Math.min(MAX_POSITIONS_LOST, Math.round(lost));
}

function deriveConfidence(
  competitors: AuditCompetitorsData,
  primaryVelocity: number,
  competitorAvg: number,
): "low" | "medium" | "high" {
  if (competitors.competitors.length < 3) return "low";
  if (competitorAvg <= 0 || primaryVelocity > competitorAvg) return "low";
  return "medium";
}
