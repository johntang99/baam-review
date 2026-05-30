import type { NearbyCandidate } from "./nearby-search-client";

export interface FilterArgs {
  primaryPlaceId: string;
  excludePlaceIds?: string[];
  minReviews?: number;
}

export interface FilterResult {
  kept: NearbyCandidate[];
  excludedCount: number;
}

export function filterCandidates(
  candidates: NearbyCandidate[],
  args: FilterArgs,
): FilterResult {
  const excludeSet = new Set([
    args.primaryPlaceId,
    ...(args.excludePlaceIds ?? []),
  ]);
  const minReviews = args.minReviews ?? 1;

  let excludedCount = 0;
  const kept: NearbyCandidate[] = [];

  for (const c of candidates) {
    if (excludeSet.has(c.id)) {
      excludedCount++;
      continue;
    }
    if (c.businessStatus && c.businessStatus !== "OPERATIONAL") {
      excludedCount++;
      continue;
    }
    if ((c.userRatingCount ?? 0) < minReviews) {
      excludedCount++;
      continue;
    }
    kept.push(c);
  }

  return { kept, excludedCount };
}
