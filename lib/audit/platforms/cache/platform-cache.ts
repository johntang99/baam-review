import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import {
  AuditPlatformDataSchema,
  type AuditPlatformData,
  type PlatformKey,
} from "../types";
import type { Tier } from "../../google/types";

const TABLE = "audit_platform_data";
const TTL_FREE_MS = 7 * 24 * 60 * 60 * 1000;
const TTL_PAID_MS = 24 * 60 * 60 * 1000;

export async function readCachedPlatformData(args: {
  placeId: string;
  platform: PlatformKey;
  tier: Tier;
}): Promise<AuditPlatformData | null> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data } = await (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            eq: (col: string, val: string) => {
              gt: (col: string, val: string) => {
                maybeSingle: () => Promise<{
                  data: { data: unknown } | null;
                  error: unknown;
                }>;
              };
            };
          };
        };
      };
    };
  })
    .from(TABLE)
    .select("data")
    .eq("business_place_id", args.placeId)
    .eq("platform", args.platform)
    .eq("tier", args.tier)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (!data) return null;

  const parsed = AuditPlatformDataSchema.safeParse(data.data);
  return parsed.success ? parsed.data : null;
}

export async function writeCachedPlatformData(args: {
  placeId: string;
  platform: PlatformKey;
  tier: Tier;
  payload: AuditPlatformData;
}): Promise<void> {
  const supabase = createServiceClient();
  const ttl = args.tier === "paid" ? TTL_PAID_MS : TTL_FREE_MS;
  const now = new Date();

  await (supabase as unknown as {
    from: (t: string) => {
      upsert: (row: unknown, opts: { onConflict: string }) => Promise<{ error: unknown }>;
    };
  })
    .from(TABLE)
    .upsert(
      {
        business_place_id: args.placeId,
        platform: args.platform,
        tier: args.tier,
        data: args.payload,
        fetched_at: now.toISOString(),
        expires_at: new Date(now.getTime() + ttl).toISOString(),
      },
      { onConflict: "business_place_id,platform,tier" },
    );
}
