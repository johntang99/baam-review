import { buildVelocityAnchors, scoreFromVelocity } from "../benchmarks";
import type { VerticalBenchmarks } from "../benchmarks/types";
import type { AuditGoogleData } from "../google/types";
import type { ScoreComponent } from "./types";

export type VelocityWindow = "30d" | "180d" | "365d";

const WINDOW_MONTHS: Record<VelocityWindow, number> = {
  "30d": 1,
  "180d": 6,
  "365d": 12,
};

export function computeVelocity(
  window: VelocityWindow,
  google: AuditGoogleData,
  benchmarks: VerticalBenchmarks,
): ScoreComponent {
  const perMonth = velocityFor(window, google) ?? 0;
  const reviewsInWindow = reviewCountFor(window, google);

  const score = scoreFromVelocity(perMonth, benchmarks.rubric.velocity);
  const weight = weightFor(window, benchmarks);

  return {
    raw_score: roundScore(score),
    weight,
    weighted_contribution: score * weight,
    measured_value: perMonth,
    measured_value_label: formatLabel(window, perMonth),
    measured_value_calculation: formatCalculation(window, reviewsInWindow),
    rubric_anchors: buildVelocityAnchors(benchmarks),
  };
}

function velocityFor(window: VelocityWindow, google: AuditGoogleData): number | null {
  switch (window) {
    case "30d":
      return google.reviews_aggregate.velocity_30d_per_month;
    case "180d":
      return google.reviews_aggregate.velocity_180d_per_month;
    case "365d":
      return google.reviews_aggregate.velocity_365d_per_month;
  }
}

function reviewCountFor(window: VelocityWindow, google: AuditGoogleData): number | null {
  switch (window) {
    case "30d":
      return google.reviews_aggregate.reviews_30d;
    case "180d":
      return google.reviews_aggregate.reviews_180d;
    case "365d":
      return google.reviews_aggregate.reviews_365d;
  }
}

function weightFor(window: VelocityWindow, benchmarks: VerticalBenchmarks): number {
  switch (window) {
    case "30d":
      return benchmarks.weights.velocity_30d;
    case "180d":
      return benchmarks.weights.velocity_180d;
    case "365d":
      return benchmarks.weights.velocity_365d;
  }
}

function formatLabel(window: VelocityWindow, perMonth: number): string {
  const value = `${perMonth.toFixed(1)} / mo`;
  return window === "30d" ? value : `${value} avg`;
}

function formatCalculation(
  window: VelocityWindow,
  reviewsInWindow: number | null,
): string | null {
  if (reviewsInWindow == null) return null;
  if (window === "30d") {
    return `${reviewsInWindow} review${reviewsInWindow === 1 ? "" : "s"} past 30 days`;
  }
  const months = WINDOW_MONTHS[window];
  return `${reviewsInWindow} review${reviewsInWindow === 1 ? "" : "s"} ÷ ${months} months`;
}

function roundScore(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)));
}
