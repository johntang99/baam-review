import { z } from "zod";
import { VerticalKeySchema } from "../google/types";

export const RegionKeySchema = z.enum(["national", "nyc_metro"]);
export type RegionKey = z.infer<typeof RegionKeySchema>;

export const RubricAnchorSchema = z.object({
  label: z.string(),
  value: z.number(),
  score: z.number().min(0).max(100),
  is_key: z.boolean(),
});
export type RubricAnchor = z.infer<typeof RubricAnchorSchema>;

export const RatingRubricSchema = z.object({
  curve: z.array(
    z.object({ rating: z.number(), score: z.number().min(0).max(100) }),
  ),
});
export type RatingRubric = z.infer<typeof RatingRubricSchema>;

export const VolumeRubricSchema = z.object({
  thresholds: z.array(
    z.object({ count: z.number(), score: z.number().min(0).max(100) }),
  ),
});
export type VolumeRubric = z.infer<typeof VolumeRubricSchema>;

export const VelocityRubricSchema = z.object({
  thresholds: z.array(
    z.object({ per_month: z.number(), score: z.number().min(0).max(100) }),
  ),
});
export type VelocityRubric = z.infer<typeof VelocityRubricSchema>;

export const VerticalBenchmarksSchema = z.object({
  vertical: VerticalKeySchema,
  region: RegionKeySchema,
  version: z.string(),
  source: z.string(),
  effective_from: z.string(),

  per_review_value: z.object({
    range_low_usd: z.number(),
    range_high_usd: z.number(),
    median_usd: z.number(),
    horizon_months: z.number(),
  }),

  healthy_velocity: z.object({
    minimum_per_month: z.number(),
    optimal_low_per_month: z.number(),
    optimal_high_per_month: z.number(),
    aggressive_per_month: z.number(),
  }),

  rubric: z.object({
    rating: RatingRubricSchema,
    volume: VolumeRubricSchema,
    velocity: VelocityRubricSchema,
  }),

  weights: z.object({
    rating_quality: z.number(),
    review_volume: z.number(),
    velocity_30d: z.number(),
    velocity_180d: z.number(),
    velocity_365d: z.number(),
  }),

  competitor_baseline: z
    .object({
      typical_total_count: z.number(),
      typical_velocity_30d: z.number(),
      typical_rating: z.number(),
      last_updated: z.string(),
    })
    .nullable(),

  projection: z
    .object({
      ranking_slide_onset_weeks: z.number(),
      velocity_half_life_days: z.number(),
      competitor_velocity_default: z.number(),
      ramp_months_with_baam: z.number(),
    })
    .optional(),
});
export type VerticalBenchmarks = z.infer<typeof VerticalBenchmarksSchema>;
