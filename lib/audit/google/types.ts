import { z } from "zod";

export const VERTICAL_KEYS = [
  "tcm_clinic",
  "dental",
  "legal_immigration",
  "restaurant",
  "real_estate",
  "hotel",
  "auto",
  "contractor",
  "salon_spa",
  "cafe",
  "apparel",
  "health_food",
  "insurance",
  "general_smb",
] as const;

export const VerticalKeySchema = z.enum(VERTICAL_KEYS);
export type VerticalKey = z.infer<typeof VerticalKeySchema>;

export const TierSchema = z.enum(["free", "paid"]);
export type Tier = z.infer<typeof TierSchema>;

export const BusinessReferenceSchema = z
  .object({
    placeId: z.string().min(1).optional(),
    textQuery: z.string().min(1).optional(),
    expectedLanguages: z.array(z.string()).optional(),
    forceRefresh: z.boolean().optional(),
  })
  .refine((v) => v.placeId || v.textQuery, {
    message: "Provide placeId or textQuery",
  });
export type BusinessReference = z.infer<typeof BusinessReferenceSchema>;

export const ReviewSchema = z.object({
  author_name: z.string(),
  author_avatar_url: z.string().nullish(),
  rating: z.number().int().min(0).max(5),
  text: z.string(),
  language: z.string(),
  relative_time_description: z.string().nullish(),
  timestamp: z.string(),
  has_owner_response: z.boolean(),
  owner_response_text: z.string().nullish(),
  owner_response_timestamp: z.string().nullish(),
  owner_response_time_hours: z.number().nullish(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const AuditGoogleDataSchema = z.object({
  business: z.object({
    name: z.string(),
    name_secondary: z.string().optional(),
    formatted_address: z.string(),
    address_lines: z.array(z.string()),
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
    place_id: z.string(),
    business_url: z.string(),
    website: z.string().optional(),
    phone: z.string().optional(),
    lat: z.number().nullish(),
    lng: z.number().nullish(),
  }),

  vertical: z.object({
    google_categories: z.array(z.string()),
    primary_category: z.string(),
    inferred_vertical: VerticalKeySchema,
    confidence: z.number().min(0).max(1),
  }),

  language: z.object({
    primary_language: z.enum(["en", "zh", "other"]),
    is_bilingual: z.boolean(),
    is_chinese_business: z.boolean(),
    detection_signals: z.object({
      name_has_cjk: z.boolean(),
      gbp_locale: z.string(),
      review_language_distribution: z.record(z.string(), z.number()),
    }),
  }),

  profile_health: z.object({
    is_claimed: z.boolean(),
    is_verified: z.boolean(),
    has_hours: z.boolean(),
    has_phone: z.boolean(),
    has_website: z.boolean(),
    has_categories: z.boolean(),
    has_description: z.boolean(),
    photos_count: z.number().int().min(0),
    profile_completeness: z.number().min(0).max(100),
  }),

  reviews_aggregate: z.object({
    total_count: z.number().int().min(0),
    rating: z.number().min(0).max(5),
    last_review_date: z.string().nullable(),
    last_review_days_ago: z.number().nullable(),
    reviews_30d: z.number().nullable(),
    reviews_90d: z.number().nullable(),
    reviews_180d: z.number().nullable(),
    reviews_365d: z.number().nullable(),
    velocity_30d_per_month: z.number().nullable(),
    velocity_180d_per_month: z.number().nullable(),
    velocity_365d_per_month: z.number().nullable(),
    response_rate: z.number().min(0).max(1).nullable(),
    response_time_median_hours: z.number().nullable(),
    unanswered_count: z.number().nullable(),
    photo_review_count: z.number().nullable(),
  }),

  reviews: z.array(ReviewSchema),

  meta: z.object({
    fetched_at: z.string(),
    expires_at: z.string(),
    data_source: z.enum(["place_details", "place_details_plus_outscraper"]),
    tier: TierSchema,
    cache_hit: z.boolean(),
    degraded: z
      .object({
        outscraper_failed: z.boolean(),
        reason: z.string(),
      })
      .optional(),
  }),
});
export type AuditGoogleData = z.infer<typeof AuditGoogleDataSchema>;
