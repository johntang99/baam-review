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

  if (tier === "paid") {
    try {
      const client = new OutscraperGoogleReviewsClient(config.outscraperApiKey);
      outscraperReviews = await client.fetchReviews(placeId);
    } catch (err) {
      outscraperReviews = null;
      degraded = {
        outscraper_failed: true,
        reason: err instanceof Error ? err.message : String(err),
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

  if (!degraded) {
    await writeCachedAuditData(normalized, ttlMs).catch((err) => {
      console.error("[audit-google] cache write failed:", err);
    });
  }

  return normalized;
}
