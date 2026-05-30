import "server-only";
import type { AuditGoogleData, VerticalKey } from "../google/types";
import { fetchActiveBenchmark } from "./benchmark-client";
import type { RegionKey, VerticalBenchmarks } from "./types";

export { BenchmarkNotFoundError } from "./errors";
export { scoreFromRating } from "./score-from-rating";
export { scoreFromVolume } from "./score-from-volume";
export { scoreFromVelocity } from "./score-from-velocity";
export {
  buildRatingAnchors,
  buildVolumeAnchors,
  buildVelocityAnchors,
} from "./anchor-builders";
export type {
  VerticalBenchmarks,
  RegionKey,
  RatingRubric,
  VolumeRubric,
  VelocityRubric,
  RubricAnchor,
} from "./types";

export async function getBenchmarks(
  vertical: VerticalKey,
  region: RegionKey = "national",
): Promise<VerticalBenchmarks> {
  return fetchActiveBenchmark(vertical, region);
}

export async function getBenchmarksForBusiness(
  business: AuditGoogleData,
): Promise<VerticalBenchmarks> {
  const region = deriveRegion(business);
  return fetchActiveBenchmark(business.vertical.inferred_vertical, region);
}

function deriveRegion(business: AuditGoogleData): RegionKey {
  const zip = business.business.zip.trim();
  if (!zip) return "national";

  const nycPrefixes = ["100", "101", "102", "104", "110", "111", "112", "113", "114", "115", "116"];
  if (nycPrefixes.some((p) => zip.startsWith(p))) return "nyc_metro";

  return "national";
}
