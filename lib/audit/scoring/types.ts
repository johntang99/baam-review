import { z } from "zod";
import { RubricAnchorSchema } from "../benchmarks/types";

export const ScoreComponentSchema = z.object({
  raw_score: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
  weighted_contribution: z.number(),
  measured_value: z.number(),
  measured_value_label: z.string(),
  measured_value_calculation: z.string().nullable(),
  rubric_anchors: z.array(RubricAnchorSchema),
});
export type ScoreComponent = z.infer<typeof ScoreComponentSchema>;

export const ComponentKeySchema = z.enum([
  "rating_quality",
  "review_volume",
  "velocity_30d",
  "velocity_180d",
  "velocity_365d",
]);
export type ComponentKey = z.infer<typeof ComponentKeySchema>;

export const GradeSchema = z.enum(["A", "B", "C", "D", "F"]);
export type Grade = z.infer<typeof GradeSchema>;

export const AuditScoreSchema = z.object({
  total: z.number().int().min(0).max(100),
  grade: GradeSchema,
  grade_diagnosis: z.string(),

  components: z.object({
    rating_quality: ScoreComponentSchema,
    review_volume: ScoreComponentSchema,
    velocity_30d: ScoreComponentSchema,
    velocity_180d: ScoreComponentSchema,
    velocity_365d: ScoreComponentSchema,
  }),

  critical_floor_applied: z.boolean(),
  critical_floor_reason: z.string().nullable(),
  uncapped_total: z.number().int().min(0).max(100),

  weakest_component: ComponentKeySchema,

  benchmark_version: z.string(),
  computed_at: z.string(),
});
export type AuditScore = z.infer<typeof AuditScoreSchema>;
