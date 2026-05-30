import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import {
  AuditGoogleDataSchema,
  type AuditGoogleData,
  type Tier,
} from "../types";
import { CacheError } from "../errors";

const TABLE = "audit_business_data";

// Cast: audit_business_data is not yet in generated Database types.
// Regenerate via supabase gen types once CLI is installed; for now we
// treat this table as untyped at the client boundary.
function untypedFrom(supabase: ReturnType<typeof createServiceClient>) {
  return (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            gt: (col: string, val: string) => {
              maybeSingle: () => Promise<{
                data: { data: unknown } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
      upsert: (
        row: unknown,
        options: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
  }).from(TABLE);
}

export async function readCachedAuditData(
  placeId: string,
  tier: Tier,
): Promise<AuditGoogleData | null> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await untypedFrom(supabase)
    .select("data")
    .eq("place_id", placeId)
    .eq("tier", tier)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (error) throw new CacheError(`read failed: ${error.message}`);
  if (!data) return null;

  const parsed = AuditGoogleDataSchema.safeParse(data.data);
  if (!parsed.success) return null;

  return { ...parsed.data, meta: { ...parsed.data.meta, cache_hit: true } };
}

export async function writeCachedAuditData(
  payload: AuditGoogleData,
  ttlMs: number,
): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  const row = {
    place_id: payload.business.place_id,
    tier: payload.meta.tier,
    data: payload,
    fetched_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    data_source: payload.meta.data_source,
  };

  const { error } = await untypedFrom(supabase).upsert(row, {
    onConflict: "place_id,tier",
  });

  if (error) throw new CacheError(`write failed: ${error.message}`);
}
