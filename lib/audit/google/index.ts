import "server-only";
import { getAuditGoogleConfig } from "./config";
import {
  BusinessHasNoReviewsError,
  InvalidBusinessReferenceError,
} from "./errors";
import { fetchPlaceDetails } from "./clients/place-details-client";
import { searchPlaceIdByText } from "./clients/place-search-client";
import {
  OutscraperGoogleReviewsClient,
  type RawOutscraperReview,
} from "./clients/outscraper-google-reviews-client";
import {
  readCachedAuditData,
  readCachedAuditDataAllowExpired,
  writeCachedAuditData,
} from "./cache/supabase-cache";
import { normalizeGoogleData } from "./normalizers/google-normalizer";
import {
  BusinessReferenceSchema,
  type AuditGoogleData,
  type BusinessReference,
  type Tier,
} from "./types";

export type { AuditGoogleData, BusinessReference, Tier } from "./types";
export {
  AuditDataError,
  BusinessHasNoReviewsError,
  BusinessNotFoundError,
  GoogleApiError,
  InvalidBusinessReferenceError,
  OutscraperError,
  CacheError,
} from "./errors";

export async function getGoogleBusinessData(
  input: BusinessReference,
  tier: Tier,
  options: { reviewsTimeoutMs?: number; reviewsLimit?: number } = {},
): Promise<AuditGoogleData> {
  const parsed = BusinessReferenceSchema.safeParse(input);
  if (!parsed.success) throw new InvalidBusinessReferenceError();

  const config = getAuditGoogleConfig();

  const placeId =
    parsed.data.placeId ??
    (await searchPlaceIdByText(
      parsed.data.textQuery!,
      config.googlePlacesApiKey,
    ));

  if (!parsed.data.forceRefresh) {
    const cached = await readCachedAuditData(placeId, tier);
    if (cached) return cached;
  }

  const rawPlace = await fetchPlaceDetails(placeId, config.googlePlacesApiKey);

  if (
    !rawPlace.userRatingCount ||
    rawPlace.userRatingCount === 0
  ) {
    throw new BusinessHasNoReviewsError(placeId);
  }

  let outscraperReviews: RawOutscraperReview[] | null = null;
  let degraded: { outscraper_failed: boolean; reason: string } | undefined;
  let usedReducedOutscraperLimit = false;

  if (tier === "paid") {
    const client = new OutscraperGoogleReviewsClient(config.outscraperApiKey);
    const errors: string[] = [];
    const attempts: Array<{ limit?: number; timeoutMs?: number }> = [
      { limit: options.reviewsLimit, timeoutMs: options.reviewsTimeoutMs },
    ];
    // Competitor fetches often run with a strict 30s budget. Retry once with a
    // lighter payload and longer timeout before degrading to Place-only data.
    if (typeof options.reviewsTimeoutMs === "number") {
      attempts.push({
        limit: Math.min(options.reviewsLimit ?? 1000, 250),
        timeoutMs: Math.max(options.reviewsTimeoutMs + 15_000, 45_000),
      });
    }

    for (let i = 0; i < attempts.length && !outscraperReviews; i += 1) {
      const attempt = attempts[i];
      try {
        const reviews = await client.fetchReviews(placeId, {
          limit: attempt.limit,
          timeoutMs: attempt.timeoutMs,
        });
        if (reviews.length > 0) {
          outscraperReviews = reviews;
          if (
            typeof attempt.limit === "number" &&
            attempt.limit > 0 &&
            attempt.limit < 1000
          ) {
            usedReducedOutscraperLimit = true;
          }
          break;
        }
        errors.push(
          `attempt ${i + 1}: outscraper returned empty reviews_data`,
        );
      } catch (err) {
        errors.push(
          `attempt ${i + 1}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (!outscraperReviews) {
      const fallbackReason = errors.join(" | ");
      const stale = await readCachedAuditDataAllowExpired(placeId, tier).catch(
        () => null,
      );
      if (isUsablePaidCache(stale)) {
        return {
          ...stale,
          reviews_aggregate: {
            ...stale.reviews_aggregate,
            total_count: rawPlace.userRatingCount ?? stale.reviews_aggregate.total_count,
            rating: rawPlace.rating ?? stale.reviews_aggregate.rating,
          },
          meta: {
            ...stale.meta,
            cache_hit: true,
            degraded: {
              outscraper_failed: true,
              reason: `${fallbackReason}; reused cached paid history from ${stale.meta.fetched_at}`,
            },
          },
        };
      }

      degraded = {
        outscraper_failed: true,
        reason: fallbackReason || "outscraper failed",
      };
    }
  }

  const fetchedAt = new Date();
  const ttlMs = tier === "paid" ? config.cacheTtlPaidMs : config.cacheTtlFreeMs;
  const expiresAt = new Date(fetchedAt.getTime() + ttlMs);

  const normalized = normalizeGoogleData({
    rawPlace,
    outscraperReviews,
    tier,
    cacheHit: false,
    fetchedAt,
    expiresAt,
    degraded,
  });

  if (!degraded && !usedReducedOutscraperLimit) {
    await writeCachedAuditData(normalized, ttlMs).catch((err) => {
      console.error("[audit-google] cache write failed:", err);
    });
  }

  return normalized;
}

function isUsablePaidCache(
  cached: AuditGoogleData | null,
): cached is AuditGoogleData {
  if (!cached) return false;
  if (cached.meta.data_source !== "place_details_plus_outscraper") return false;
  if (cached.reviews.length === 0) return false;
  const fetchedAt = Date.parse(cached.meta.fetched_at);
  if (Number.isNaN(fetchedAt)) return false;
  const ageMs = Date.now() - fetchedAt;
  const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
  return ageMs <= MAX_AGE_MS;
}
