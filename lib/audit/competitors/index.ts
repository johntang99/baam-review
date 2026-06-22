import "server-only";
import {
  getGoogleBusinessData,
  type AuditGoogleData,
  type Tier,
} from "../google";
import { getAuditGoogleConfig } from "../google/config";
import { aggregateCompetitorStats } from "./aggregator";
import { filterCandidates } from "./competitor-filter";
import {
  isGenericCompetitorKeyword,
  resolveBackfillKeywordsFromPrimaryKeyword,
  resolvePrimaryKeywords,
  resolveRelatedKeywordsFromPrimaryKeyword,
  resolveServiceKeyword,
} from "./keyword-resolver";
import { canonicalizeService } from "../service-taxonomy";
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
const MAX_PRIMARY_KEYWORD_VARIANTS = 5;
const BROAD_DISCOVERY_MIN_REVIEWS = 1;
const MIN_REVIEWS_FOR_COMPETITOR = 10;
const PLACE_DETAILS_COST_PER_CALL = 0.025;
const NAME_SIMILARITY_SELF_THRESHOLD = 0.78;
const NAME_SIMILARITY_SAME_ADDRESS_THRESHOLD = 0.56;
const SELF_DISTANCE_MILES_THRESHOLD = 0.18;
const BRAND_CLUSTER_STOPWORDS = new Set([
  "the",
  "and",
  "of",
  "for",
  "women",
  "womens",
  "woman",
  "health",
  "healthcare",
  "clinic",
  "center",
  "medical",
  "doctor",
  "md",
  "hospital",
  "group",
  "associates",
  "care",
  "services",
  "service",
]);
const SPECIALTY_TOKEN_STOPWORDS = new Set([
  "clinic",
  "center",
  "medical",
  "service",
  "services",
  "doctor",
  "care",
]);

export async function getCompetitorsData(
  primary: AuditGoogleData,
  tier: Tier,
  options: GetCompetitorsOptions = {},
): Promise<AuditCompetitorsData> {
  const config = getAuditGoogleConfig();

  const overrideRaw = String(options.service_override ?? "").trim();
  const primary_service_keyword = (
    canonicalizeService(overrideRaw) ||
    overrideRaw ||
    resolveServiceKeyword(primary)
  ).trim();
  const keyword_variants = resolvePrimaryKeywords(
    primary,
    primary_service_keyword,
  ).slice(0, MAX_PRIMARY_KEYWORD_VARIANTS);
  const primary_keyword = keyword_variants[0];
  const wanted = options.count ?? DEFAULT_COMPETITOR_COUNT;
  const selectedPlaceIds = normalizePlaceIds(options.include_place_ids)
    .filter((id) => id !== primary.business.place_id)
    .slice(0, wanted);
  const radius_used_miles =
    options.radius_miles ??
    resolveSearchRadiusMiles(primary.business.zip, primary_keyword);

  if (selectedPlaceIds.length > 0) {
    const competitors = await fetchCompetitorsByPlaceIds(
      primary,
      selectedPlaceIds,
      tier,
    );
    return {
      primary_place_id: primary.business.place_id,
      competitors,
      search_metadata: {
        primary_keyword,
        primary_service_keyword,
        keyword_variants,
        selected_place_ids: selectedPlaceIds,
        selection_mode: "manual_selected",
        radius_used_miles,
        total_candidates_found: selectedPlaceIds.length,
        candidates_excluded: 0,
        discovery_pool_size: selectedPlaceIds.length,
        strict_pool_size: competitors.length,
      },
      competitor_aggregate: aggregateCompetitorStats(primary, competitors),
      meta: {
        fetched_at: new Date().toISOString(),
        tier,
        total_api_calls: competitors.length,
        estimated_cost_usd: PLACE_DETAILS_COST_PER_CALL * competitors.length,
      },
    };
  }

  if (primary.business.lat == null || primary.business.lng == null) {
    throw new Error(
      "getCompetitorsData: primary business is missing lat/lng — refresh Session 1 data",
    );
  }

  const searchByKeywordVariants = async (keywords: string[]) => {
    const variantResults = await Promise.all(
      keywords.map((kw) =>
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
    return mergeNearbyCandidatesByPlaceId(variantResults);
  };

  let executedKeywordVariants = [...keyword_variants];
  let fallback_keyword_variants: string[] = [];
  let fallback_reason: string | null = null;

  let rawCandidates = await searchByKeywordVariants(executedKeywordVariants);
  let filtered = filterCandidates(rawCandidates, {
    primaryPlaceId: primary.business.place_id,
    excludePlaceIds: options.exclude_place_ids,
    minReviews: BROAD_DISCOVERY_MIN_REVIEWS,
  });
  let kept = filtered.kept;
  let excludedCount = filtered.excludedCount;

  let strictShortlist = strictShortlistNearbyCandidates(kept, {
    limit: wanted,
    primaryLat: primary.business.lat!,
    primaryLng: primary.business.lng!,
    primaryName: primary.business.name,
    primaryAddress:
      primary.business.formatted_address || "",
    minReviews: MIN_REVIEWS_FOR_COMPETITOR,
    discoveryKeyword: primary_service_keyword,
    previewMode: Boolean(options.preview_mode),
  });

  const minPreferredCompetitors = Math.min(
    options.preview_mode ? 5 : 4,
    wanted,
  );
  const minForControlledBroadBackfill = Math.min(4, wanted);
  const shouldFallback =
    strictShortlist.length < minPreferredCompetitors || rawCandidates.length <= 1;
  const fallbackReasons: string[] = [];

  const runFallbackPass = async (keywords: string[], reason: string) => {
    const newKeywords = keywords.filter((kw) => !executedKeywordVariants.includes(kw));
    if (newKeywords.length === 0) return false;
    const fallbackCandidates = await searchByKeywordVariants(newKeywords);
    rawCandidates = mergeNearbyCandidatesByPlaceId([
      rawCandidates,
      fallbackCandidates,
    ]);
    executedKeywordVariants = unique([
      ...executedKeywordVariants,
      ...newKeywords,
    ]);
    fallback_keyword_variants = unique([
      ...fallback_keyword_variants,
      ...newKeywords,
    ]);
    fallbackReasons.push(reason);

    filtered = filterCandidates(rawCandidates, {
      primaryPlaceId: primary.business.place_id,
      excludePlaceIds: options.exclude_place_ids,
      minReviews: BROAD_DISCOVERY_MIN_REVIEWS,
    });
    kept = filtered.kept;
    excludedCount = filtered.excludedCount;
    strictShortlist = strictShortlistNearbyCandidates(kept, {
      limit: wanted,
      primaryLat: primary.business.lat!,
      primaryLng: primary.business.lng!,
      primaryName: primary.business.name,
      primaryAddress:
        primary.business.formatted_address || "",
      minReviews: MIN_REVIEWS_FOR_COMPETITOR,
      discoveryKeyword: primary_service_keyword,
      previewMode: Boolean(options.preview_mode),
    });
    return true;
  };

  if (shouldFallback) {
    await runFallbackPass(
      resolveRelatedKeywordsFromPrimaryKeyword({
        primary_keyword: primary_service_keyword,
        city: primary.business.city,
      }),
      "related_specialty",
    );

    if (strictShortlist.length < minPreferredCompetitors && options.preview_mode) {
      const backfill = resolveBackfillKeywordsFromPrimaryKeyword({
        primary_keyword: primary_service_keyword,
        city: primary.business.city,
      });
      await runFallbackPass(backfill.specialty, "backfill_specialty_tier1");
      if (strictShortlist.length < minForControlledBroadBackfill) {
        await runFallbackPass(
          backfill.controlled_broad,
          "backfill_controlled_broad",
        );
      }
    }

    if (
      strictShortlist.length < minPreferredCompetitors &&
      options.service_override?.trim()
    ) {
      const shouldUseAutoServiceFallback =
        !options.preview_mode || strictShortlist.length < Math.min(3, wanted);
      const autoServiceKeyword = resolveServiceKeyword(primary);
      const shouldSkipAutoServiceForPreview =
        Boolean(options.preview_mode) &&
        isMedicalSpecialtyKeyword(normalizeKeywordSignature(primary_service_keyword)) &&
        isBroadMedicalAutoKeyword(autoServiceKeyword);

      if (!shouldUseAutoServiceFallback) {
        // No-op: current specialty shortlist is sufficient for preview quality.
      } else if (shouldSkipAutoServiceForPreview) {
        fallbackReasons.push("auto_service_preview_guard");
      } else if (!isGenericCompetitorKeyword(autoServiceKeyword)) {
        await runFallbackPass(
          resolvePrimaryKeywords(primary, autoServiceKeyword).slice(
            0,
            MAX_PRIMARY_KEYWORD_VARIANTS,
          ),
          "auto_service",
        );
      } else if (fallbackReasons.length === 0) {
        fallbackReasons.push("auto_service_generic_skipped");
      }
    }
    if (fallbackReasons.length === 0) {
      fallbackReasons.push("no_backfill_queries");
    }
  }
  fallback_reason = fallbackReasons.length > 0 ? fallbackReasons.join(",") : null;
  const topCandidates = strictShortlist;

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
      primary_service_keyword,
      keyword_variants: executedKeywordVariants,
      fallback_keyword_variants:
        fallback_keyword_variants.length > 0
          ? fallback_keyword_variants
          : undefined,
      fallback_reason: fallback_reason || undefined,
      radius_used_miles,
      total_candidates_found: rawCandidates.length,
      candidates_excluded: excludedCount,
      discovery_pool_size: kept.length,
      strict_pool_size: strictShortlist.length,
      selection_mode: "search",
    },
    competitor_aggregate: aggregateCompetitorStats(primary, competitors),
    meta: {
      fetched_at: new Date().toISOString(),
      tier,
      total_api_calls: executedKeywordVariants.length + competitors.length,
      estimated_cost_usd:
        PLACE_DETAILS_COST_PER_CALL *
        (executedKeywordVariants.length + competitors.length),
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
      //
      // Competitors are secondary data: cap their Outscraper review fetch at
      // 30s so one slow/hung scrape can't push the whole pipeline past the
      // serverless time limit. On timeout it degrades to Google reviews (the
      // competitor still appears) rather than stalling generation.
      const data = await getGoogleBusinessData(
        { placeId: candidate.id },
        tier,
        { reviewsTimeoutMs: 30_000 },
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
    .map((r, index) => ({
      ...r.value,
      rank: index + 1,
    }));
}

async function fetchCompetitorsByPlaceIds(
  primary: AuditGoogleData,
  placeIds: string[],
  tier: Tier,
): Promise<AuditCompetitor[]> {
  const primaryLat = primary.business.lat;
  const primaryLng = primary.business.lng;

  const results = await Promise.allSettled(
    placeIds.map(async (placeId) => {
      const data = await getGoogleBusinessData(
        { placeId },
        tier,
        { reviewsTimeoutMs: 30_000 },
      );
      if (data.business.place_id === primary.business.place_id) {
        return null;
      }
      const distance_miles =
        data.business.lat != null &&
        data.business.lng != null &&
        primaryLat != null &&
        primaryLng != null
          ? haversineMiles(
              { lat: primaryLat, lng: primaryLng },
              { lat: data.business.lat, lng: data.business.lng },
            )
          : null;
      const competitor: AuditCompetitor = {
        rank: 0,
        google: data,
        platforms: null,
        distance_miles,
        shares_primary_keyword: true,
      };
      return competitor;
    }),
  );

  return results
    .filter(
      (
        r,
      ): r is PromiseFulfilledResult<AuditCompetitor | null> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value)
    .filter((value): value is AuditCompetitor => Boolean(value))
    .map((value, index) => ({
      ...value,
      rank: index + 1,
    }));
}

function mergeNearbyCandidatesByPlaceId(
  groups: Array<NearbyCandidate[]>,
): NearbyCandidate[] {
  const mergedById = new Map<string, NearbyCandidate>();
  for (const group of groups) {
    for (const place of group) {
      if (!mergedById.has(place.id)) mergedById.set(place.id, place);
    }
  }
  return Array.from(mergedById.values());
}

function strictShortlistNearbyCandidates(
  candidates: NearbyCandidate[],
  args: {
    limit: number;
    primaryLat: number;
    primaryLng: number;
    primaryName: string;
    primaryAddress: string;
    minReviews: number;
    discoveryKeyword: string;
    previewMode: boolean;
  },
): NearbyCandidate[] {
  const strict = rankAndDedupeNearbyCandidates(candidates, args, true);
  if (strict.length >= Math.min(4, args.limit)) return strict;
  return rankAndDedupeNearbyCandidates(candidates, args, false);
}

function rankAndDedupeNearbyCandidates(
  candidates: NearbyCandidate[],
  args: {
    limit: number;
    primaryLat: number;
    primaryLng: number;
    primaryName: string;
    primaryAddress: string;
    minReviews: number;
    discoveryKeyword: string;
    previewMode: boolean;
  },
  enforceMinReviews: boolean,
) {
  const primaryNameRaw = String(args.primaryName || "");
  const primaryName = normalizeKeywordSignature(primaryNameRaw);
  const primaryHead = brandHeadSignature(primaryNameRaw);
  const primaryAddress = normalizeAddressForComparison(args.primaryAddress);
  const scored = candidates
    .filter((candidate) => {
      if (!enforceMinReviews) return true;
      return (candidate.userRatingCount ?? 0) >= args.minReviews;
    })
    .map((candidate) => {
      const distance_miles =
        candidate.location
          ? haversineMiles(
              { lat: args.primaryLat, lng: args.primaryLng },
              {
                lat: candidate.location.latitude,
                lng: candidate.location.longitude,
              },
            )
          : Number.POSITIVE_INFINITY;
      const candidateNameRaw = String(candidate.displayName?.text || "");
      const candidateName = normalizeKeywordSignature(candidateNameRaw);
      const candidateHead = brandHeadSignature(candidateNameRaw);
      const candidateAddress = normalizeAddressForComparison(
        candidate.formattedAddress || "",
      );
      if (
        args.previewMode &&
        isLikelySelfDuplicate({
          primaryName,
          primaryHead,
          candidateName,
          candidateHead,
          primaryAddress,
          candidateAddress,
          distanceMiles: distance_miles,
        })
      ) {
        return null;
      }
      if (
        args.previewMode &&
        isExcludedBySpecialtyGuard(candidate, args.discoveryKeyword)
      ) {
        return null;
      }
      const score = scoreNearbyCandidate(candidate, distance_miles, {
        discoveryKeyword: args.discoveryKeyword,
        previewMode: args.previewMode,
      });
      return { candidate, distance_miles, score };
    })
    .filter(
      (
        item,
      ): item is { candidate: NearbyCandidate; distance_miles: number; score: number } =>
        Boolean(item),
    )
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.distance_miles - b.distance_miles;
    });

  const deduped: NearbyCandidate[] = [];
  const seen = new Set<string>();
  const seenBrandClusters: string[] = [];
  for (const item of scored) {
    const key = nearbyDedupeKey(item.candidate);
    if (seen.has(key)) continue;
    const brandCluster = args.previewMode
      ? nearbyBrandClusterKey(item.candidate)
      : "";
    if (
      brandCluster &&
      seenBrandClusters.some(
        (seenCluster) => stringSimilarity(seenCluster, brandCluster) >= 0.9,
      )
    ) {
      continue;
    }
    seen.add(key);
    if (brandCluster) seenBrandClusters.push(brandCluster);
    deduped.push(item.candidate);
    if (deduped.length >= args.limit) break;
  }
  return deduped;
}

function scoreNearbyCandidate(
  candidate: NearbyCandidate,
  distance_miles: number,
  args: {
    discoveryKeyword: string;
    previewMode: boolean;
  },
) {
  const reviews = Math.min(Math.max(candidate.userRatingCount ?? 0, 0), 500);
  const rating = Number.isFinite(candidate.rating as number)
    ? (candidate.rating as number)
    : 0;
  const ratingBoost = rating * 20;
  const distanceBoost = Number.isFinite(distance_miles)
    ? Math.max(0, 35 - distance_miles * 2.5)
    : 0;
  const specialtyBoost = args.previewMode
    ? scoreSpecialtyRelevanceBoost(candidate, args.discoveryKeyword)
    : 0;
  return reviews + ratingBoost + distanceBoost + specialtyBoost;
}

function nearbyDedupeKey(candidate: NearbyCandidate) {
  const address = normalizeNearbyText(candidate.formattedAddress || "");
  if (address) return `address:${address}`;
  const name = normalizeNearbyText(candidate.displayName?.text || "");
  if (name) return `name:${name}`;
  return `id:${candidate.id}`;
}

function normalizeNearbyText(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeAddressForComparison(input: string) {
  return normalizeKeywordSignature(
    String(input || "")
      .replace(/\b(apt|apartment|suite|ste|unit|fl|floor|room|rm|#)\b.*$/i, "")
      .replace(/\b(usa|united states)\b/gi, " "),
  );
}

function normalizeKeywordSignature(input: string | null | undefined) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSignature(input: string) {
  return input.split(" ").map((t) => t.trim()).filter(Boolean);
}

function nameTokenSimilarity(a: string, b: string) {
  const aTokens = new Set(
    tokenizeSignature(a).filter((token) => token.length > 2 && !BRAND_CLUSTER_STOPWORDS.has(token)),
  );
  const bTokens = new Set(
    tokenizeSignature(b).filter((token) => token.length > 2 && !BRAND_CLUSTER_STOPWORDS.has(token)),
  );
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection++;
  }
  const union = new Set([...aTokens, ...bTokens]).size;
  return union > 0 ? intersection / union : 0;
}

function isLikelySelfDuplicate(args: {
  primaryName: string;
  primaryHead: string;
  candidateName: string;
  candidateHead: string;
  primaryAddress: string;
  candidateAddress: string;
  distanceMiles: number;
}) {
  if (!args.primaryName || !args.candidateName) return false;
  const similarity = nameTokenSimilarity(args.primaryName, args.candidateName);
  const hasAddressData = Boolean(args.primaryAddress && args.candidateAddress);
  const sameAddress = hasAddressData
    ? args.candidateAddress.includes(args.primaryAddress) ||
      args.primaryAddress.includes(args.candidateAddress)
    : false;
  if (sameAddress && similarity >= NAME_SIMILARITY_SAME_ADDRESS_THRESHOLD) return true;
  const nearSameSpot =
    Number.isFinite(args.distanceMiles) && args.distanceMiles <= SELF_DISTANCE_MILES_THRESHOLD;
  const headSimilarity = stringSimilarity(args.primaryHead, args.candidateHead);
  if (nearSameSpot && headSimilarity >= 0.86) return true;
  if (nearSameSpot && similarity >= NAME_SIMILARITY_SELF_THRESHOLD) return true;
  return false;
}

function nearbyBrandClusterKey(candidate: NearbyCandidate) {
  const signature = brandHeadSignature(candidate.displayName?.text || "");
  if (!signature) return "";
  const tokens = tokenizeSignature(signature).filter(
    (token) => token.length > 2 && !BRAND_CLUSTER_STOPWORDS.has(token),
  );
  if (tokens.length === 0) return "";
  const sorted = [...tokens].sort((a, b) => b.length - a.length || a.localeCompare(b));
  return sorted.slice(0, 2).join(" ");
}

function isMedicalSpecialtyKeyword(signature: string) {
  return /\b(obgyn|gynecolog|women|orthopedic|sports medicine|cardiology|neurology|oncology|fertility)\b/.test(
    signature,
  );
}

function isBroadMedicalAutoKeyword(keyword: string) {
  const signature = normalizeKeywordSignature(keyword);
  if (!signature) return true;
  return /\b(medical clinic|doctor|hospital|clinic)\b/.test(signature);
}

function scoreSpecialtyRelevanceBoost(
  candidate: NearbyCandidate,
  discoveryKeyword: string,
) {
  const keywordSignature = normalizeKeywordSignature(discoveryKeyword);
  if (!keywordSignature || !isMedicalSpecialtyKeyword(keywordSignature)) return 0;

  const specialtyTokens = tokenizeSignature(keywordSignature).filter(
    (token) => token.length > 2 && !SPECIALTY_TOKEN_STOPWORDS.has(token),
  );
  if (specialtyTokens.length === 0) return 0;

  const candidateTextSignature = normalizeKeywordSignature(
    `${candidate.displayName?.text || ""} ${(candidate.types ?? []).join(" ")}`,
  );
  if (!candidateTextSignature) return 0;

  let hits = 0;
  for (const token of specialtyTokens) {
    if (candidateTextSignature.includes(token)) hits++;
  }
  if (hits > 0) {
    return Math.min(hits * 24, 72);
  }

  const genericMedicalOnly = /\b(doctor|hospital|medical|clinic)\b/.test(
    candidateTextSignature,
  );
  return genericMedicalOnly ? -22 : 0;
}

function isExcludedBySpecialtyGuard(
  candidate: NearbyCandidate,
  discoveryKeyword: string,
) {
  const keywordSignature = normalizeKeywordSignature(discoveryKeyword);
  if (!keywordSignature) return false;
  const isWomensHealthCluster =
    /\b(women|womens|obgyn|gynecolog|ob gyn|ob-gyn)\b/.test(keywordSignature);
  if (!isWomensHealthCluster) return false;

  const candidateText = normalizeKeywordSignature(
    `${candidate.displayName?.text || ""} ${(candidate.types ?? []).join(" ")}`,
  );
  if (!candidateText) return false;
  return /\b(urgent care|urgent_care|family practice|family medicine|primary care|internist|internal medicine)\b/.test(
    candidateText,
  );
}

function brandHeadSignature(name: string | null | undefined) {
  const raw = String(name || "");
  const beforeColon = raw.split(":")[0];
  const stripped = beforeColon.replace(
    /\b(md|do|dds|dmd|facog|pc|llc|pllc|inc|dr)\b/gi,
    " ",
  );
  return normalizeKeywordSignature(stripped);
}

function stringSimilarity(a: string, b: string) {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left || !right) return 0;
  if (left === right) return 1;
  const distance = levenshteinDistance(left, right);
  const maxLen = Math.max(left.length, right.length);
  return maxLen > 0 ? 1 - distance / maxLen : 0;
}

function levenshteinDistance(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[rows - 1][cols - 1];
}

function unique(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function normalizePlaceIds(values: string[] | undefined) {
  if (!Array.isArray(values)) return [];
  return unique(
    values
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  );
}
