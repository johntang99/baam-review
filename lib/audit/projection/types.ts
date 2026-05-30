import { z } from "zod";
import { GradeSchema } from "../scoring/types";

export const ProjectionPointSchema = z.object({
  month: z.number().int().min(0).max(12),
  do_nothing_score: z.number().int().min(0).max(100),
  with_baam_score: z.number().int().min(0).max(100),
  do_nothing_grade: GradeSchema,
  with_baam_grade: GradeSchema,
});
export type ProjectionPoint = z.infer<typeof ProjectionPointSchema>;

export const AuditProjectionSchema = z.object({
  timeline: z.array(ProjectionPointSchema).length(13),

  six_month: z.object({
    do_nothing_score: z.number().int().min(0).max(100),
    do_nothing_grade: GradeSchema,
    with_baam_score: z.number().int().min(0).max(100),
    with_baam_grade: GradeSchema,
    score_gap: z.number().int(),
  }),

  twelve_month: z.object({
    do_nothing_score: z.number().int().min(0).max(100),
    do_nothing_grade: GradeSchema,
    with_baam_score: z.number().int().min(0).max(100),
    with_baam_grade: GradeSchema,
  }),

  revenue_impact: z.object({
    six_month_loss_usd: z.number().int().min(0),
    twelve_month_loss_usd: z.number().int().min(0),
    monthly_loss_run_rate_usd: z.number().int().min(0),
    competitor_velocity_advantage: z.number(),
    per_review_value_used: z.number(),
    months_modeled: z.number().int(),
    cumulative_at_month: z
      .array(
        z.object({
          month: z.number().int().min(0).max(12),
          loss_usd: z.number().int().min(0),
        }),
      )
      .length(13),
  }),

  ranking_estimate: z.object({
    current_position: z.number().int().min(1).max(20),
    do_nothing_six_month_position: z.number().int().min(1).max(20),
    do_nothing_six_month_drop: z.number().int(),
    confidence: z.enum(["low", "medium", "high"]),
    method: z.string(),
  }),

  parameters_used: z.object({
    velocity_decay_model: z.enum(["linear_window_drop", "exponential"]),
    ranking_slide_onset_weeks: z.number(),
    velocity_half_life_days: z.number(),
    competitor_avg_velocity: z.number(),
    benchmark_version: z.string(),
  }),

  computed_at: z.string(),
});
export type AuditProjection = z.infer<typeof AuditProjectionSchema>;
