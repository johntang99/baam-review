import "server-only";

export const HYDRATION_WARNING_THRESHOLD_MS = 60_000;
export const HYDRATION_CRITICAL_THRESHOLD_MS = 120_000;

export type HydrationWarningLevel = "none" | "warning" | "critical";

export interface HydrationGuardrail {
  pending_competitors: number;
  estimated_remaining_ms: number;
  estimated_ready_total_ms: number;
  warning_threshold_ms: number;
  critical_threshold_ms: number;
  warning_level: HydrationWarningLevel;
  service_switch_overlap_count: number | null;
  low_overlap_service_switch: boolean;
}

export function buildHydrationGuardrail(input: {
  base_duration_ms: number;
  total_competitors: number;
  hydrated_competitors: number;
  timeout_ms: number;
  service_switch_overlap_count?: number | null;
}): HydrationGuardrail {
  const pending_competitors = Math.max(
    0,
    input.total_competitors - input.hydrated_competitors,
  );
  const overlap = normalizeOverlap(input.service_switch_overlap_count);
  const low_overlap_service_switch = overlap !== null && overlap <= 1;
  const overlapPenalty = low_overlap_service_switch
    ? 1.6
    : overlap !== null && overlap <= 2
      ? 1.25
      : 1;

  const timeoutInfluencedBase = Math.min(
    Math.max(Math.round(input.timeout_ms * 0.3), 8_000),
    18_000,
  );
  const estimated_remaining_ms =
    pending_competitors > 0
      ? Math.round(pending_competitors * timeoutInfluencedBase * overlapPenalty)
      : 0;
  const estimated_ready_total_ms = Math.max(
    0,
    input.base_duration_ms + estimated_remaining_ms,
  );

  let warning_level: HydrationWarningLevel = "none";
  if (estimated_ready_total_ms >= HYDRATION_CRITICAL_THRESHOLD_MS) {
    warning_level = "critical";
  } else if (estimated_ready_total_ms >= HYDRATION_WARNING_THRESHOLD_MS) {
    warning_level = "warning";
  }

  return {
    pending_competitors,
    estimated_remaining_ms,
    estimated_ready_total_ms,
    warning_threshold_ms: HYDRATION_WARNING_THRESHOLD_MS,
    critical_threshold_ms: HYDRATION_CRITICAL_THRESHOLD_MS,
    warning_level,
    service_switch_overlap_count: overlap,
    low_overlap_service_switch,
  };
}

function normalizeOverlap(input: number | null | undefined) {
  if (typeof input !== "number" || !Number.isFinite(input)) return null;
  return Math.max(0, Math.round(input));
}
