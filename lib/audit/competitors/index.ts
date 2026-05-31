import "server-only";
import {
  getGoogleBusinessData,
  type AuditGoogleData,
  type Tier,
} from "../google";
import { getAuditGoogleConfig } from "../google/config";
import { aggregateCompetitorStats } from "./aggregator";
import { filterCandidates } from "./competitor-filter";
import { resolvePrimaryKeyword } from "./keyword-resolver";
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

const DEFAULT_COMPETITOR_COUNT = 5;
const MIN_REVIEWS_FOR_COMPETITOR = 10;
const PLACE_DETAILS_COST_PER_CALL = 0.025;

export async function getCompetitorsData(
  primary: AuditGoogleData,
  tier: Tier,
  options: GetCompetitorsOptions = {},
): Promise<AuditCompetitorsData> {
  const config = getAuditGoogleConfig();

  const primary_keyword = resolvePrimaryKeyword(primary, options.service_override);
  const radius_used_miles =
    options.radius_miles ?? resolveSearchRadiusMiles(primary.business.zip);

  if (primary.business.lat == null || primary.business.lng == null) {
    throw new Error(
      "getCompetitorsData: primary business is missing lat/lng — refresh Session 1 data",
    );
  }

  const rawCandidates = await searchNearbyByKeyword({
    keyword: primary_keyword,
    centerLat: primary.business.lat,
    centerLng: primary.business.lng,
    radiusMiles: radius_used_miles,
    maxResults: 20,
    apiKey: config.googlePlacesApiKey,
  });

  const { kept, excludedCount } = filterCandidates(rawCandidates, {
    primaryPlaceId: primary.business.place_id,
    excludePlaceIds: options.exclude_place_ids,
    minReviews: MIN_REVIEWS_FOR_COMPETITOR,
  });

  const wanted = options.count ?? DEFAULT_COMPETITOR_COUNT;
  const topCandidates = kept.slice(0, wanted);

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
      radius_used_miles,
      total_candidates_found: rawCandidates.length,
      candidates_excluded: excludedCount,
    },
    competitor_aggregate: aggregateCompetitorStats(primary, competitors),
    meta: {
      fetched_at: new Date().toISOString(),
      tier,
      total_api_calls: 1 + competitors.length,
      estimated_cost_usd:
        PLACE_DETAILS_COST_PER_CALL * (1 + competitors.length),
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
      const data = await getGoogleBusinessData(
        { placeId: candidate.id },
        "free",
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
