import "server-only";
import { getAuditGoogleConfig } from "../google/config";
import type { AuditGoogleData, Tier } from "../google/types";
import { readCachedPlatformData, writeCachedPlatformData } from "./cache/platform-cache";
import { readYelpUrlCache, writeYelpUrlCache } from "./cache/yelp-url-cache";
import { PLATFORM_VERTICAL_RELEVANCE } from "./platform-relevance";
import type { AuditPlatformData, AuditPlatformsData } from "./types";
import { YelpReviewsClient } from "./yelp/client";
import { normalizeYelpData } from "./yelp/normalizer";
import { resolveYelpUrl } from "./yelp/url-resolver";

export type { AuditPlatformData, AuditPlatformsData } from "./types";
export { PLATFORM_VERTICAL_RELEVANCE } from "./platform-relevance";

/** Fetches secondary-platform data (Yelp only in v1; Zocdoc/Healthgrades/
 *  Facebook deferred to Session 2B). Failures never propagate — missing
 *  platforms return null in the output. */
export async function getAllPlatformsData(
  business: AuditGoogleData,
  tier: Tier,
): Promise<AuditPlatformsData> {
  const relevance =
    PLATFORM_VERTICAL_RELEVANCE[business.vertical.inferred_vertical] ??
    PLATFORM_VERTICAL_RELEVANCE.general_smb;

  const platforms_attempted: string[] = [];
  const platforms_succeeded: string[] = [];
  const platforms_not_found: string[] = [];
  const platforms_errored: { platform: string; error: string }[] = [];

  let yelp: AuditPlatformData | null = null;
  if (relevance.yelp) {
    platforms_attempted.push("yelp");
    try {
      yelp = await safeFetchYelp(business, tier);
      if (yelp) platforms_succeeded.push("yelp");
      else platforms_not_found.push("yelp");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      platforms_errored.push({ platform: "yelp", error: message });
    }
  }

  return {
    yelp,
    zocdoc: null,
    healthgrades: null,
    facebook: null,
    vertical_relevance: relevance,
    meta: {
      fetched_at: new Date().toISOString(),
      tier,
      platforms_attempted,
      platforms_succeeded,
      platforms_not_found,
      platforms_errored,
    },
  };
}

async function safeFetchYelp(
  business: AuditGoogleData,
  tier: Tier,
): Promise<AuditPlatformData | null> {
  const placeId = business.business.place_id;
  const config = getAuditGoogleConfig();

  // 1. Try cache for the resolved Yelp URL
  const cached = await readYelpUrlCache(placeId);
  let yelpUrl: string | null;

  if (cached) {
    yelpUrl = cached.yelp_url;
  } else {
    const resolved = await resolveYelpUrl(business, config.outscraperApiKey);
    yelpUrl = resolved.url;
    await writeYelpUrlCache({
      placeId,
      yelpUrl,
      confidence: resolved.confidence,
    }).catch((e) => console.error("[yelp] url-cache write failed:", e));
  }

  if (!yelpUrl) return null;

  // 2. Try data cache before re-fetching reviews
  const cachedData = await readCachedPlatformData({ placeId, platform: "yelp", tier });
  if (cachedData) return cachedData;

  // 3. Fetch from Outscraper
  const client = new YelpReviewsClient(config.outscraperApiKey);
  const reviewLimit = tier === "paid" ? 25 : 5;
  const rawReviews = await client.fetchReviewsByUrl(yelpUrl, { limit: reviewLimit });

  const normalized = normalizeYelpData({ yelpUrl, reviews: rawReviews });

  await writeCachedPlatformData({
    placeId,
    platform: "yelp",
    tier,
    payload: normalized,
  }).catch((e) => console.error("[yelp] data-cache write failed:", e));

  return normalized;
}
