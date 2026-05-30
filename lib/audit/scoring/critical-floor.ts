import type { AuditGoogleData } from "../google/types";

const FLOOR_VELOCITY_THRESHOLD = 0;
const FLOOR_DAYS_THRESHOLD = 60;
const FLOOR_CAP = 49;

export interface CriticalFloorResult {
  total: number;
  applied: boolean;
  reason: string | null;
}

export function applyCriticalFloor(
  uncappedTotal: number,
  google: AuditGoogleData,
): CriticalFloorResult {
  const velocity30d = google.reviews_aggregate.velocity_30d_per_month ?? 0;
  const daysSinceLastReview =
    google.reviews_aggregate.last_review_days_ago ?? Infinity;

  if (
    velocity30d <= FLOOR_VELOCITY_THRESHOLD &&
    daysSinceLastReview > FLOOR_DAYS_THRESHOLD
  ) {
    return {
      total: Math.min(uncappedTotal, FLOOR_CAP),
      applied: uncappedTotal > FLOOR_CAP,
      reason:
        `30-day velocity is 0 and last review was ${Math.round(daysSinceLastReview)} days ago. ` +
        `A business this dormant cannot score above D regardless of historical strength.`,
    };
  }

  return { total: uncappedTotal, applied: false, reason: null };
}
