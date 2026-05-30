import type { AuditCompetitorsData } from "../competitors/types";
import type { VerticalBenchmarks } from "../benchmarks/types";
import type { AuditGoogleData } from "../google/types";
import type { AuditProjection } from "./types";

export function computeRevenueImpact(
  google: AuditGoogleData,
  competitors: AuditCompetitorsData,
  benchmarks: VerticalBenchmarks,
): AuditProjection["revenue_impact"] {
  const competitorAvg =
    competitors.competitor_aggregate.avg_velocity_30d_per_month ??
    benchmarks.projection?.competitor_velocity_default ??
    benchmarks.healthy_velocity.optimal_low_per_month;

  const primaryVelocity = google.reviews_aggregate.velocity_30d_per_month ?? 0;
  const competitorAdvantage = competitorAvg - primaryVelocity;

  const positiveAdvantage = Math.max(0, competitorAdvantage);
  const monthlyRevenueLoss =
    positiveAdvantage * benchmarks.per_review_value.median_usd;

  const cumulative_at_month = Array.from({ length: 13 }, (_, m) => ({
    month: m,
    loss_usd: Math.round(monthlyRevenueLoss * m),
  }));

  return {
    six_month_loss_usd: Math.round(monthlyRevenueLoss * 6),
    twelve_month_loss_usd: Math.round(monthlyRevenueLoss * 12),
    monthly_loss_run_rate_usd: Math.round(monthlyRevenueLoss),
    competitor_velocity_advantage: competitorAdvantage,
    per_review_value_used: benchmarks.per_review_value.median_usd,
    months_modeled: 12,
    cumulative_at_month,
  };
}
