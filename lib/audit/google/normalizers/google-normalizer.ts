import "server-only";
import { aggregateReviews } from "../aggregators/review-aggregator";
import {
  buildLanguageDistribution,
  detectLanguage,
  hasCjkCharacters,
} from "../aggregators/language-detector";
import { evaluateProfileHealth } from "../aggregators/profile-health-evaluator";
import { mapVertical } from "../aggregators/vertical-mapper";
import type {
  RawPlaceAddressComponent,
  RawPlaceDetails,
  RawPlaceReview,
} from "../clients/place-details-client";
import type { RawOutscraperReview } from "../clients/outscraper-google-reviews-client";
import type { AuditGoogleData, Review, Tier } from "../types";

export interface NormalizeInput {
  rawPlace: RawPlaceDetails;
  outscraperReviews: RawOutscraperReview[] | null;
  tier: Tier;
  cacheHit: boolean;
  fetchedAt: Date;
  expiresAt: Date;
  degraded?: { outscraper_failed: boolean; reason: string };
}

export function normalizeGoogleData(input: NormalizeInput): AuditGoogleData {
  const { rawPlace, outscraperReviews, tier, cacheHit, fetchedAt, expiresAt } =
    input;

  const reviews = outscraperReviews
    ? outscraperReviews.map(mapOutscraperReview)
    : (rawPlace.reviews ?? []).map(mapPlaceDetailsReview);

  const address = parseAddress(
    rawPlace.addressComponents ?? [],
    rawPlace.formattedAddress ?? "",
  );

  const name = rawPlace.displayName?.text ?? "(unknown)";
  const nameLanguage = rawPlace.displayName?.languageCode ?? "en";
  const nameHasCjk = hasCjkCharacters(name);

  const reviewLanguageDistribution = buildLanguageDistribution(
    reviews.map((r) => r.text).filter((t) => t.trim().length > 0),
  );

  const isChineseBusiness = detectChineseBusiness({
    nameHasCjk,
    nameLanguage,
    reviewLanguageDistribution,
  });

  const types = rawPlace.types ?? [];
  const verticalMatch = mapVertical(types, name);

  const aggregates = aggregateReviews(reviews, fetchedAt);

  const isPaidWithFullHistory = tier === "paid" && outscraperReviews !== null;
  const data_source = isPaidWithFullHistory
    ? "place_details_plus_outscraper"
    : "place_details";

  const primaryLanguage =
    reviewLanguageDistribution["zh"] && reviewLanguageDistribution["zh"] > 0.5
      ? "zh"
      : reviewLanguageDistribution["en"] &&
          reviewLanguageDistribution["en"] >= 0.5
        ? "en"
        : isChineseBusiness
          ? "zh"
          : "en";

  return {
    business: {
      name,
      name_secondary: extractSecondaryName(name) ?? undefined,
      formatted_address: rawPlace.formattedAddress ?? "",
      address_lines: (rawPlace.formattedAddress ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      ...address,
      place_id: rawPlace.id,
      business_url: rawPlace.googleMapsUri ?? "",
      website: rawPlace.websiteUri,
      phone: rawPlace.nationalPhoneNumber ?? rawPlace.internationalPhoneNumber,
      lat: rawPlace.location?.latitude ?? null,
      lng: rawPlace.location?.longitude ?? null,
    },

    vertical: {
      google_categories: types,
      primary_category: rawPlace.primaryType ?? verticalMatch.primary_category,
      inferred_vertical: verticalMatch.inferred_vertical,
      confidence: verticalMatch.confidence,
    },

    language: {
      primary_language: primaryLanguage,
      is_bilingual: isBilingual(reviewLanguageDistribution),
      is_chinese_business: isChineseBusiness,
      detection_signals: {
        name_has_cjk: nameHasCjk,
        gbp_locale: nameLanguage,
        review_language_distribution: reviewLanguageDistribution,
      },
    },

    profile_health: evaluateProfileHealth({
      business_status: rawPlace.businessStatus,
      url: rawPlace.googleMapsUri,
      formatted_phone_number: rawPlace.nationalPhoneNumber,
      website: rawPlace.websiteUri,
      opening_hours: rawPlace.regularOpeningHours,
      types: rawPlace.types,
      photos: rawPlace.photos,
    }),

    reviews_aggregate: {
      total_count: rawPlace.userRatingCount ?? aggregates.total_count,
      rating: rawPlace.rating ?? 0,
      last_review_date: aggregates.last_review_date,
      last_review_days_ago: aggregates.last_review_days_ago,
      reviews_30d: aggregates.reviews_30d,
      reviews_90d: isPaidWithFullHistory ? aggregates.reviews_90d : null,
      reviews_180d: isPaidWithFullHistory ? aggregates.reviews_180d : null,
      reviews_365d: isPaidWithFullHistory ? aggregates.reviews_365d : null,
      velocity_30d_per_month: aggregates.velocity_30d_per_month,
      velocity_180d_per_month: isPaidWithFullHistory
        ? aggregates.velocity_180d_per_month
        : null,
      velocity_365d_per_month: isPaidWithFullHistory
        ? aggregates.velocity_365d_per_month
        : null,
      response_rate: isPaidWithFullHistory ? aggregates.response_rate : null,
      response_time_median_hours: isPaidWithFullHistory
        ? aggregates.response_time_median_hours
        : null,
      unanswered_count: isPaidWithFullHistory
        ? aggregates.unanswered_count
        : null,
      photo_review_count: null,
    },

    reviews,

    meta: {
      fetched_at: fetchedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      data_source,
      tier,
      cache_hit: cacheHit,
      degraded: input.degraded,
    },
  };
}

function mapPlaceDetailsReview(r: RawPlaceReview): Review {
  const text = r.originalText?.text ?? r.text?.text ?? "";
  return {
    author_name: r.authorAttribution?.displayName ?? "Anonymous",
    author_avatar_url: r.authorAttribution?.photoUri,
    rating: r.rating ?? 0,
    text,
    language: text ? detectLanguage(text) : "other",
    relative_time_description: r.relativePublishTimeDescription,
    timestamp: r.publishTime ?? new Date(0).toISOString(),
    has_owner_response: false,
  };
}

function mapOutscraperReview(r: RawOutscraperReview): Review {
  const text = r.review_text ?? "";
  const hasResponse = !!r.owner_answer && r.owner_answer.length > 0;
  const reviewMs = r.review_timestamp ? r.review_timestamp * 1000 : 0;
  const responseMs = r.owner_answer_timestamp
    ? r.owner_answer_timestamp * 1000
    : 0;
  const response_time_hours =
    hasResponse && reviewMs > 0 && responseMs > 0
      ? (responseMs - reviewMs) / (60 * 60 * 1000)
      : undefined;

  return {
    author_name: r.author_title ?? "Anonymous",
    author_avatar_url: r.author_image ?? undefined,
    rating: r.review_rating ?? 0,
    text,
    language: text ? detectLanguage(text) : "other",
    timestamp: r.review_datetime_utc ?? new Date(reviewMs).toISOString(),
    has_owner_response: hasResponse,
    owner_response_text: hasResponse ? r.owner_answer : undefined,
    owner_response_timestamp: hasResponse
      ? (r.owner_answer_datetime_utc ?? undefined)
      : undefined,
    owner_response_time_hours: response_time_hours,
  };
}

const NYC_BOROUGHS = new Set([
  "Queens",
  "Brooklyn",
  "Manhattan",
  "Bronx",
  "Staten Island",
  "New York",
]);

function parseAddress(
  components: RawPlaceAddressComponent[],
  formatted: string,
): { street: string; city: string; state: string; zip: string; country: string } {
  const byType = (type: string, short = false): string => {
    const c = components.find((x) => x.types.includes(type));
    if (!c) return "";
    return short ? c.shortText : c.longText;
  };

  const streetNumber = byType("street_number");
  const route = byType("route");
  const street = [streetNumber, route].filter(Boolean).join(" ");

  const locality = byType("locality");
  const sublocality = byType("sublocality_level_1") || byType("sublocality");
  const neighborhood = byType("neighborhood");

  let city: string;
  if (sublocality && NYC_BOROUGHS.has(sublocality) && neighborhood) {
    city = neighborhood;
  } else if (locality && NYC_BOROUGHS.has(locality) && (neighborhood || sublocality)) {
    city = neighborhood || sublocality;
  } else {
    city = locality || neighborhood || sublocality || byType("postal_town") || "";
  }

  const state = byType("administrative_area_level_1", true);
  const zip = byType("postal_code");
  const country = byType("country", true);

  if (street || city || state || zip) {
    return { street, city, state, zip, country };
  }
  return { street: "", city: "", state: "", zip: "", country: "", ...parseFromFormatted(formatted) };
}

function parseFromFormatted(formatted: string): Partial<{
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}> {
  const parts = formatted.split(",").map((s) => s.trim());
  if (parts.length < 3) return {};
  return {
    street: parts[0],
    city: parts[1],
    state: parts[2]?.split(" ")[0] ?? "",
    zip: parts[2]?.split(" ")[1] ?? "",
    country: parts[3] ?? "",
  };
}

function detectChineseBusiness(args: {
  nameHasCjk: boolean;
  nameLanguage: string;
  reviewLanguageDistribution: Record<string, number>;
}): boolean {
  if (args.nameHasCjk) return true;
  if (args.nameLanguage.startsWith("zh")) return true;
  const zhShare = args.reviewLanguageDistribution["zh"] ?? 0;
  return zhShare >= 0.2;
}

function isBilingual(distribution: Record<string, number>): boolean {
  const sorted = Object.values(distribution).sort((a, b) => b - a);
  if (sorted.length < 2) return false;
  return sorted[1] >= 0.2;
}

function extractSecondaryName(name: string): string | null {
  const ascii = name.replace(/[^\x00-\x7F]+/g, "").trim();
  const cjk = name.replace(/[\x00-\x7F]+/g, "").trim();
  if (ascii && cjk) return cjk;
  return null;
}
