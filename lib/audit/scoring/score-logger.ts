import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { AuditGoogleData } from "../google/types";
import type { VerticalBenchmarks } from "../benchmarks/types";
import type { AuditScore } from "./types";

const TABLE = "audit_score_runs";

export async function logScoreRun(
  google: AuditGoogleData,
  benchmarks: VerticalBenchmarks,
  score: AuditScore,
): Promise<void> {
  const supabase = createServiceClient();
  const supabaseAny = supabase as unknown as {
    from: (t: string) => {
      insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };

  const row = {
    business_place_id: google.business.place_id,
    vertical: google.vertical.inferred_vertical,
    region: benchmarks.region,
    tier: google.meta.tier,
    benchmark_version: benchmarks.version,

    composite_rating: google.reviews_aggregate.rating,
    total_count: google.reviews_aggregate.total_count,
    velocity_30d: google.reviews_aggregate.velocity_30d_per_month,
    velocity_180d: google.reviews_aggregate.velocity_180d_per_month,
    velocity_365d: google.reviews_aggregate.velocity_365d_per_month,

    total_score: score.total,
    grade: score.grade,
    critical_floor_applied: score.critical_floor_applied,

    rating_quality_score: score.components.rating_quality.raw_score,
    review_volume_score: score.components.review_volume.raw_score,
    velocity_30d_score: score.components.velocity_30d.raw_score,
    velocity_180d_score: score.components.velocity_180d.raw_score,
    velocity_365d_score: score.components.velocity_365d.raw_score,
  };

  const { error } = await supabaseAny.from(TABLE).insert(row);
  if (error) {
    console.error("[scoring] score log insert failed:", error.message);
  }
}
