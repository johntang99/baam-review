import "server-only";
import {
  getGoogleBusinessData,
  type AuditGoogleData,
  type Tier,
} from "../google";
import { getAuditGoogleConfig } from "../google/config";
import { aggregateCompetitorStats } from "./aggregator";
import { filterCandidates } from "./competitor-filter";
import { resolvePrimaryKeywords } from "./keyword-resolver";
import { resolveSearchRadiusMiles } from "./radius-resolver";
import {
  haversineMiles,
  searchNearbyByKeyword,
  type NearbyCandidate,
} from "./nearby-search-client";
import type {
  AuditCompetitor,
  AuditCompetitorsData,
  GetCompetitorsOptions,
} from "./types";

export type {
  AuditCompetitor,
  AuditCompetitorsData,
  GetCompetitorsOptions,
} from "./types";

const DEFAULT_COMPETITOR_COUNT = 7;
const MIN_REVIEWS_FOR_COMPETITOR = 10;
const PLACE_DETAILS_COST_PER_CALL = 0.025;

export async function getCompetitorsData(
  primary: AuditGoogleData,
  tier: Tier,
  options: GetCompetitorsOptions = {},
): Promise<AuditCompetitorsData> {
  const config = getAuditGoogleConfig();

  const keyword_variants = resolvePrimaryKeywords(primary, options.service_override);
  const primary_keyword = keyword_variants[0];
  const radius_used_miles =
    options.radius_miles ??
    resolveSearchRadiusMiles(primary.business.zip, primary_keyword);

  if (primary.business.lat == null || primary.business.lng == null) {
    throw new Error(
      "getCompetitorsData: primary business is missing lat/lng — refresh Session 1 data",
    );
  }

  // Multi-pass search: run each keyword variant in parallel, then merge by
  // place_id. Catches famous competitors that rank under one synonym but
  // not another (e.g. Kleinfeld appears for "wedding dress shop" but not
  // "bridal boutique").
  const variantResults = await Promise.all(
    keyword_variants.map((kw) =>
      searchNearbyByKeyword({
        keyword: kw,
        centerLat: primary.business.lat!,
        centerLng: primary.business.lng!,
        radiusMiles: radius_used_miles,
        maxResults: 20,
        apiKey: config.googlePlacesApiKey,
      }),
    ),
  );
  const mergedById = new Map<string, (typeof variantResults)[number][number]>();
  for (const results of variantResults) {
    for (const place of results) {
      if (!mergedById.has(place.id)) mergedById.set(place.id, place);
    }
  }
  const rawCandidates = Array.from(mergedById.values());

  const { kept, excludedCount } = filterCandidates(rawCandidates, {
    primaryPlaceId: primary.business.place_id,
    excludePlaceIds: options.exclude_place_ids,
    minReviews: MIN_REVIEWS_FOR_COMPETITOR,
  });

  // Sort by review count descending — favor famous/established competitors
  // over near-but-tiny ones. These are the names "customers see before
  // yours" so brand recognition > proximity.
  const sortedKept = [...kept].sort(
    (a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0),
  );

  const wanted = options.count ?? DEFAULT_COMPETITOR_COUNT;
  const topCandidates = sortedKept.slice(0, wanted);

  const competitors = await fetchCompetitorsInParallel(
    primary,
    topCandidates,
    tier,
  );

  return {
    primary_place_id: primary.business.place_id,
    competitors,
    search_metadata: {
      primary_keyword,
      keyword_variants,
      radius_used_miles,
      total_candidates_found: rawCandidates.length,
      candidates_excluded: excludedCount,
    },
    competitor_aggregate: aggregateCompetitorStats(primary, competitors),
    meta: {
      fetched_at: new Date().toISOString(),
      tier,
      total_api_calls: keyword_variants.length + competitors.length,
      estimated_cost_usd:
        PLACE_DETAILS_COST_PER_CALL *
        (keyword_variants.length + competitors.length),
    },
  };
}

async function fetchCompetitorsInParallel(
  primary: AuditGoogleData,
  candidates: NearbyCandidate[],
  tier: Tier,
): Promise<AuditCompetitor[]> {
  const primaryLat = primary.business.lat ?? 0;
  const primaryLng = primary.business.lng ?? 0;

  const results = await Promise.allSettled(
    candidates.map(async (candidate, idx) => {
      // Competitors honor the parent tier. Free tier returns 5 reviews
      // in Google's non-chronological "relevance" order, which makes
      // reviews_30d unreliable (typically reads 0 even for active
      // businesses). Paid tier uses Outscraper's full chronological
      // history → accurate velocity numbers for the comparison table.
      const data = await getGoogleBusinessData(
        { placeId: candidate.id },
        tier,
      );

      const distance_miles =
        candidate.location &&
        primary.business.lat != null &&
        primary.business.lng != null
          ? haversineMiles(
              { lat: primaryLat, lng: primaryLng },
              {
                lat: candidate.location.latitude,
                lng: candidate.location.longitude,
              },
            )
          : null;

      const competitor: AuditCompetitor = {
        rank: idx + 1,
        google: data,
        platforms: null,
        distance_miles,
        shares_primary_keyword: true,
      };
      return competitor;
    }),
  );

  void tier;
  return results
    .filter(
      (r): r is PromiseFulfilledResult<AuditCompetitor> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);
}
