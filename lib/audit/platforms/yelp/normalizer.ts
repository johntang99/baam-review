import { detectLanguage } from "../../google/aggregators/language-detector";
import type { Review } from "../../google/types";
import type { AuditPlatformData } from "../types";
import type { RawYelpReview } from "./client";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface NormalizeYelpInput {
  yelpUrl: string;
  reviews: RawYelpReview[];
  asOf?: Date;
}

export function normalizeYelpData(input: NormalizeYelpInput): AuditPlatformData {
  const slug = extractSlug(input.yelpUrl);
  const asOf = input.asOf ?? new Date();
  const fetched_at = asOf.toISOString();

  const reviews = input.reviews.map(mapYelpReview);
  const ratings = reviews
    .map((r) => r.rating)
    .filter((n) => n > 0);
  const rating = ratings.length > 0
    ? ratings.reduce((s, n) => s + n, 0) / ratings.length
    : null;

  const businessName = input.reviews[0]?.business_name ?? slug;

  const last_review_date = reviews
    .map((r) => Date.parse(r.timestamp))
    .filter((n) => !Number.isNaN(n) && n > 0)
    .sort((a, b) => b - a)[0];

  return {
    platform: "yelp",
    platform_id: slug,
    platform_url: input.yelpUrl,
    business_name_on_platform: businessName,

    rating: rating !== null ? roundHalf(rating) : null,
    total_count: reviews.length,
    last_review_date: last_review_date ? new Date(last_review_date).toISOString() : null,
    last_review_days_ago: last_review_date
      ? Math.floor((asOf.getTime() - last_review_date) / ONE_DAY_MS)
      : null,

    profile_health: {
      is_claimed: true,
      has_photos: false,
      has_hours: false,
      has_description: false,
      completeness: reviews.length > 0 ? 70 : 30,
    },

    reviews,

    meta: {
      fetched_at,
      data_source: "google-serp + outscraper-yelp",
    },
  };
}

function mapYelpReview(r: RawYelpReview): Review {
  const text = r.review_text ?? "";
  const hasResponse = !!r.owner_reply && r.owner_reply.length > 0;
  const reviewMs = r.timestamp ? r.timestamp * 1000 : Date.parse(r.datetime_utc ?? "");
  const replyMs = r.owner_reply_timestamp
    ? r.owner_reply_timestamp * 1000
    : Date.parse(r.owner_reply_datetime_utc ?? "");
  const response_time_hours =
    hasResponse && !Number.isNaN(reviewMs) && !Number.isNaN(replyMs) && replyMs > reviewMs
      ? (replyMs - reviewMs) / (60 * 60 * 1000)
      : undefined;

  return {
    author_name: r.author_title ?? "Yelp user",
    author_avatar_url: r.author_image ?? undefined,
    rating: r.review_rating ?? 0,
    text,
    language: text ? detectLanguage(text) : "other",
    timestamp: !Number.isNaN(reviewMs)
      ? new Date(reviewMs).toISOString()
      : new Date(0).toISOString(),
    has_owner_response: hasResponse,
    owner_response_text: hasResponse ? r.owner_reply ?? undefined : undefined,
    owner_response_timestamp: hasResponse ? r.owner_reply_datetime_utc ?? undefined : undefined,
    owner_response_time_hours: response_time_hours,
  };
}

function extractSlug(url: string): string {
  const m = url.match(/\/biz\/([a-z0-9\-]+)/i);
  return m?.[1]?.toLowerCase() ?? "";
}

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}
