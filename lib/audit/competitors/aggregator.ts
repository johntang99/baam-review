import type { AuditGoogleData } from "../google/types";
import type { AuditCompetitor, AuditCompetitorsData } from "./types";

export function aggregateCompetitorStats(
  primary: AuditGoogleData,
  competitors: AuditCompetitor[],
): AuditCompetitorsData["competitor_aggregate"] {
  if (competitors.length === 0) {
    return {
      avg_rating: null,
      avg_review_count: null,
      avg_velocity_30d_per_month: null,
      median_velocity_30d_per_month: null,
      top_velocity_30d_per_month: null,
      velocity_gap_vs_primary: null,
    };
  }

  const ratings = competitors.map((c) => c.google.reviews_aggregate.rating);
  const counts = competitors.map((c) => c.google.reviews_aggregate.total_count);
  const velocities = competitors
    .map((c) => c.google.reviews_aggregate.velocity_30d_per_month)
    .filter((v): v is number => v !== null);

  const avg_velocity =
    velocities.length > 0 ? mean(velocities) : null;
  const primary_velocity = primary.reviews_aggregate.velocity_30d_per_month;
  const velocity_gap =
    avg_velocity !== null && primary_velocity !== null
      ? avg_velocity - primary_velocity
      : null;

  return {
    avg_rating: mean(ratings),
    avg_review_count: mean(counts),
    avg_velocity_30d_per_month: avg_velocity,
    median_velocity_30d_per_month: median(velocities),
    top_velocity_30d_per_month:
      velocities.length > 0 ? Math.max(...velocities) : null,
    velocity_gap_vs_primary: velocity_gap,
  };
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
