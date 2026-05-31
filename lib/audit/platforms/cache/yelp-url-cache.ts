import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { ResolutionConfidence } from "../yelp/url-resolver";

const TABLE = "yelp_url_cache";

export interface YelpUrlCacheEntry {
  yelp_url: string | null;
  resolution_confidence: ResolutionConfidence;
}

export async function readYelpUrlCache(
  placeId: string,
): Promise<YelpUrlCacheEntry | null> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data } = await (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          gt: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: YelpUrlCacheEntry | null;
              error: unknown;
            }>;
          };
        };
      };
    };
  })
    .from(TABLE)
    .select("yelp_url,resolution_confidence")
    .eq("business_place_id", placeId)
    .gt("expires_at", nowIso)
    .maybeSingle();

  return data;
}

export async function writeYelpUrlCache(args: {
  placeId: string;
  yelpUrl: string | null;
  confidence: ResolutionConfidence;
}): Promise<void> {
  const supabase = createServiceClient();
  await (supabase as unknown as {
    from: (t: string) => {
      upsert: (row: unknown, opts: { onConflict: string }) => Promise<{ error: unknown }>;
    };
  })
    .from(TABLE)
    .upsert(
      {
        business_place_id: args.placeId,
        yelp_url: args.yelpUrl,
        resolution_confidence: args.confidence,
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "business_place_id" },
    );
}
