import { z } from "zod";
import { ReviewSchema, TierSchema } from "../google/types";

export const PLATFORM_KEYS = [
  "yelp",
  "zocdoc",
  "healthgrades",
  "facebook",
] as const;

export const PlatformKeySchema = z.enum(PLATFORM_KEYS);
export type PlatformKey = z.infer<typeof PlatformKeySchema>;

export const AuditPlatformDataSchema = z.object({
  platform: PlatformKeySchema,
  platform_id: z.string(),
  platform_url: z.string(),
  business_name_on_platform: z.string(),

  rating: z.number().min(0).max(5).nullable(),
  total_count: z.number().int().min(0),
  last_review_date: z.string().nullable(),
  last_review_days_ago: z.number().nullable(),

  profile_health: z.object({
    is_claimed: z.boolean(),
    has_photos: z.boolean(),
    has_hours: z.boolean(),
    has_description: z.boolean(),
    completeness: z.number().min(0).max(100),
  }),

  reviews: z.array(ReviewSchema),

  meta: z.object({
    fetched_at: z.string(),
    data_source: z.string(),
  }),
});
export type AuditPlatformData = z.infer<typeof AuditPlatformDataSchema>;

export const PlatformRelevanceSchema = z.object({
  yelp: z.boolean(),
  zocdoc: z.boolean(),
  healthgrades: z.boolean(),
  facebook: z.boolean(),
});
export type PlatformRelevance = z.infer<typeof PlatformRelevanceSchema>;

export const AuditPlatformsDataSchema = z.object({
  yelp: AuditPlatformDataSchema.nullable(),
  zocdoc: AuditPlatformDataSchema.nullable(),
  healthgrades: AuditPlatformDataSchema.nullable(),
  facebook: AuditPlatformDataSchema.nullable(),

  vertical_relevance: PlatformRelevanceSchema,

  meta: z.object({
    fetched_at: z.string(),
    tier: TierSchema,
    platforms_attempted: z.array(z.string()),
    platforms_succeeded: z.array(z.string()),
    platforms_not_found: z.array(z.string()),
    platforms_errored: z.array(
      z.object({ platform: z.string(), error: z.string() }),
    ),
  }),
});
export type AuditPlatformsData = z.infer<typeof AuditPlatformsDataSchema>;
