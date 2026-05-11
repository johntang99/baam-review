import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Soft limits that flag the resulting review_request without blocking the send.
 * Hard limits (different threshold) abort the send entirely.
 */
const SOFT_HOURLY = 20;
const SOFT_DAILY = 100;
const HARD_HOURLY = 60;
const HARD_DAILY = 300;

export type VelocityVerdict =
  | { kind: "ok" }
  | { kind: "flag"; reason: "velocity:hourly" | "velocity:daily" }
  | { kind: "block"; reason: "velocity:hourly" | "velocity:daily"; current: number; limit: number };

export async function checkVelocity(locationId: string): Promise<VelocityVerdict> {
  const supabase = createServiceClient();
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: hourly }, { count: daily }] = await Promise.all([
    supabase
      .from("review_requests")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .gte("created_at", oneHourAgo),
    supabase
      .from("review_requests")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .gte("created_at", oneDayAgo),
  ]);

  const h = hourly ?? 0;
  const d = daily ?? 0;

  if (h >= HARD_HOURLY) {
    return { kind: "block", reason: "velocity:hourly", current: h, limit: HARD_HOURLY };
  }
  if (d >= HARD_DAILY) {
    return { kind: "block", reason: "velocity:daily", current: d, limit: HARD_DAILY };
  }
  if (h >= SOFT_HOURLY) {
    return { kind: "flag", reason: "velocity:hourly" };
  }
  if (d >= SOFT_DAILY) {
    return { kind: "flag", reason: "velocity:daily" };
  }
  return { kind: "ok" };
}
