import { z } from "zod";
import { AuditGoogleDataSchema, TierSchema } from "../google/types";

export const AuditCompetitorSchema = z.object({
  rank: z.number().int().min(1),
  google: AuditGoogleDataSchema,
  platforms: z.null(),
  distance_miles: z.number().nullable(),
  shares_primary_keyword: z.boolean(),
});
export type AuditCompetitor = z.infer<typeof AuditCompetitorSchema>;

export const AuditCompetitorsDataSchema = z.object({
  primary_place_id: z.string(),
  competitors: z.array(AuditCompetitorSchema),
  search_metadata: z.object({
    primary_keyword: z.string(),
    primary_service_keyword: z.string().optional(),
    keyword_variants: z.array(z.string()).optional(),
    fallback_keyword_variants: z.array(z.string()).optional(),
    fallback_reason: z.string().optional(),
    selected_place_ids: z.array(z.string()).optional(),
    selection_mode: z.enum(["search", "manual_selected"]).optional(),
    radius_used_miles: z.number(),
    total_candidates_found: z.number().int().min(0),
    candidates_excluded: z.number().int().min(0),
    discovery_pool_size: z.number().int().min(0).optional(),
    strict_pool_size: z.number().int().min(0).optional(),
  }),
  competitor_aggregate: z.object({
    avg_rating: z.number().nullable(),
    avg_review_count: z.number().nullable(),
    avg_velocity_30d_per_month: z.number().nullable(),
    median_velocity_30d_per_month: z.number().nullable(),
    top_velocity_30d_per_month: z.number().nullable(),
    velocity_gap_vs_primary: z.number().nullable(),
  }),
  meta: z.object({
    fetched_at: z.string(),
    tier: TierSchema,
    total_api_calls: z.number().int().min(0),
    estimated_cost_usd: z.number().min(0),
  }),
});
export type AuditCompetitorsData = z.infer<typeof AuditCompetitorsDataSchema>;

export interface GetCompetitorsOptions {
  count?: number;
  radius_miles?: number;
  exclude_place_ids?: string[];
  /** If provided, skip search and use these selected places directly. */
  include_place_ids?: string[];
  /** Used by intake preview to favor specialty matches and suppress noisy duplicates. */
  preview_mode?: boolean;
  /** Force a specific service keyword (e.g. "bridal boutique"). When set,
   *  overrides the auto-detected service from Google types / name tokens. */
  service_override?: string;
}
