import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  BusinessHasNoReviewsError,
  BusinessNotFoundError,
  getGoogleBusinessData,
} from "@/lib/audit/google";
import { getCompetitorsData } from "@/lib/audit/competitors";
import { canonicalizeService } from "@/lib/audit/service-taxonomy";
import { aggregateCompetitorStats } from "@/lib/audit/competitors/aggregator";
import type {
  AuditCompetitor,
  AuditCompetitorsData,
} from "@/lib/audit/competitors/types";
import {
  createCompetitorScenario,
  updateCompetitorScenario,
} from "@/lib/audit/competitors/scenario-cache";
import { getAuditGoogleConfig } from "@/lib/audit/google/config";
import { readCachedAuditData } from "@/lib/audit/google/cache/supabase-cache";
import { buildHydrationGuardrail } from "@/lib/audit/competitors/hydration-guardrail";

export const runtime = "nodejs";
export const maxDuration = 180;

interface PreviewRequest {
  place_id?: string;
  service_override?: string;
  count?: number;
  radius_miles?: number;
  fast_mode?: boolean;
  previous_competitor_place_ids?: string[];
}

function clampCount(input: number | undefined) {
  if (typeof input !== "number" || !Number.isFinite(input)) return 7;
  const rounded = Math.floor(input);
  if (rounded < 1) return 1;
  if (rounded > 12) return 12;
  return rounded;
}

function parseRadiusMiles(input: number | undefined) {
  if (typeof input !== "number" || !Number.isFinite(input)) return undefined;
  if (input <= 0) return undefined;
  return Math.min(input, 50);
}

function parseFastMode(input: boolean | undefined) {
  return input !== false;
}

function parsePlaceIdList(input: string[] | undefined) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0),
    ),
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!auth.user.email_confirmed_at) {
    return NextResponse.json({ error: "email_not_verified" }, { status: 403 });
  }

  let body: PreviewRequest;
  try {
    body = (await request.json()) as PreviewRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const placeId = String(body.place_id ?? "").trim();
  const serviceOverride = String(body.service_override ?? "").trim();
  if (!placeId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!serviceOverride) {
    return NextResponse.json({ error: "specific_service_required" }, { status: 400 });
  }

  try {
    const startedAt = Date.now();
    const fastMode = parseFastMode(body.fast_mode);
    const count = clampCount(body.count);
    const radiusMiles = parseRadiusMiles(body.radius_miles);
    const previousCompetitorPlaceIds = parsePlaceIdList(
      body.previous_competitor_place_ids,
    );
    const primary = await getGoogleBusinessData({ placeId }, "free");
    const canonicalServiceOverride = canonicalizeService(serviceOverride);
    let competitorsData: AuditCompetitorsData;
    if (fastMode) {
      const discovered = await getCompetitorsData(primary, "free", {
        service_override: serviceOverride,
        count,
        radius_miles: radiusMiles,
        preview_mode: true,
      });
      competitorsData = await mergeWithPaidCache(primary, discovered);
    } else {
      competitorsData = await getCompetitorsData(primary, "paid", {
        service_override: serviceOverride,
        count,
        radius_miles: radiusMiles,
        preview_mode: true,
      });
    }
    const hydration = summarizeHydrationProgress(competitorsData.competitors);
    const currentCompetitorPlaceIds = uniquePlaceIds(
      competitorsData.competitors
        .map((item) => item.google.business.place_id)
        .filter((value): value is string => Boolean(value)),
    );
    const serviceSwitchOverlapCount =
      previousCompetitorPlaceIds.length > 0
        ? currentCompetitorPlaceIds.filter((placeId) =>
            previousCompetitorPlaceIds.includes(placeId),
          ).length
        : null;
    const scenario = await createCompetitorScenario({
      user_id: auth.user.id,
      primary_place_id: primary.business.place_id,
      service_override: serviceOverride,
      service_override_canonical: canonicalServiceOverride,
      competitors_data: competitorsData,
      status: hydration.status,
      total_competitors: hydration.total_competitors,
      hydrated_competitors: hydration.hydrated_competitors,
      failed_competitors: 0,
      hydrated_place_ids: hydration.hydrated_place_ids,
    }).catch((err) => {
      console.error("[competitors-preview] scenario cache write failed:", err);
      return null;
    });

    const cacheStats = summarizeCompetitorCache(competitorsData);
    const durationMs = Date.now() - startedAt;
    const config = getAuditGoogleConfig();
    const hydrationGuardrail = buildHydrationGuardrail({
      base_duration_ms: durationMs,
      total_competitors: hydration.total_competitors,
      hydrated_competitors: hydration.hydrated_competitors,
      timeout_ms: config.competitorOutscraperTimeoutMs,
      service_switch_overlap_count: serviceSwitchOverlapCount,
    });
    const shouldPrewarmLowOverlap =
      hydrationGuardrail.low_overlap_service_switch && fastMode;

    after(async () => {
      await refreshStaleCompetitorCaches(competitorsData.competitors).catch(
        (err) => {
          console.error("[competitors-preview] background refresh failed:", err);
        },
      );
      if (shouldPrewarmLowOverlap) {
        await prewarmLowOverlapCompetitorCaches(competitorsData.competitors).catch(
          (err) => {
            console.error("[competitors-preview] low-overlap prewarm failed:", err);
          },
        );
      }
      if (scenario?.scenario_id && hydration.status === "hydrating") {
        await hydrateCompetitorScenarioInBackground({
          scenario_id: scenario.scenario_id,
          user_id: auth.user.id,
          primary_place_id: primary.business.place_id,
          current_data: competitorsData,
        }).catch((err) => {
          console.error("[competitors-preview] hydrate missing failed:", err);
        });
      }
    });

    return NextResponse.json({
      fast_mode: fastMode,
      scenario_id: scenario?.scenario_id ?? null,
      scenario_expires_at: scenario?.expires_at ?? null,
      status: hydration.status,
      total_competitors: hydration.total_competitors,
      hydrated_competitors: hydration.hydrated_competitors,
      failed_competitors: 0,
      duration_ms: durationMs,
      cache_stats: cacheStats,
      hydration_guardrail: {
        ...hydrationGuardrail,
        low_overlap_prewarm_triggered: shouldPrewarmLowOverlap,
      },
      generated_at: new Date().toISOString(),
      service_override: serviceOverride,
      primary: {
        place_id: primary.business.place_id ?? null,
        name: primary.business.name,
        city: primary.business.city,
        rating: primary.reviews_aggregate.rating,
        total_count: primary.reviews_aggregate.total_count,
      },
      search_metadata: competitorsData.search_metadata,
      competitors: competitorsData.competitors.map((item) => ({
        rank: item.rank,
        place_id: item.google.business.place_id ?? null,
        name: item.google.business.name,
        city: item.google.business.city,
        rating: item.google.reviews_aggregate.rating,
        total_count: item.google.reviews_aggregate.total_count,
        distance_miles: item.distance_miles,
        primary_category:
          item.google.vertical.primary_category_display ||
          item.google.vertical.primary_category ||
          null,
      })),
    });
  } catch (err) {
    if (err instanceof BusinessNotFoundError) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (err instanceof BusinessHasNoReviewsError) {
      return NextResponse.json({ error: "NO_REVIEWS" }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[competitors-preview] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function summarizeCompetitorCache(
  competitorsData: Awaited<ReturnType<typeof getCompetitorsData>>,
) {
  const total = competitorsData.competitors.length;
  const cache_hits = competitorsData.competitors.filter(
    (item) => item.google.meta.cache_hit,
  ).length;
  const cache_misses = total - cache_hits;
  const degraded_results = competitorsData.competitors.filter(
    (item) =>
      item.google.meta.degraded?.outscraper_failed ||
      item.google.meta.data_source === "place_details",
  ).length;
  return {
    total,
    cache_hits,
    cache_misses,
    degraded_results,
    cache_hit_ratio_pct: total > 0 ? Math.round((cache_hits / total) * 100) : 0,
  };
}

async function refreshStaleCompetitorCaches(
  competitors: Awaited<ReturnType<typeof getCompetitorsData>>["competitors"],
) {
  const config = getAuditGoogleConfig();
  const stalePlaceIds = competitors
    .filter((item) => item.google.meta.cache_hit)
    .filter((item) => {
      const fetchedAt = Date.parse(item.google.meta.fetched_at);
      if (!Number.isFinite(fetchedAt)) return false;
      return Date.now() - fetchedAt >= config.competitorBackgroundRefreshAgeMs;
    })
    .map((item) => item.google.business.place_id)
    .filter((placeId): placeId is string => Boolean(placeId))
    .slice(0, 3);

  if (stalePlaceIds.length === 0) return;
  const refreshTimeoutMs = Math.min(config.competitorOutscraperTimeoutMs, 60_000);
  await Promise.allSettled(
    stalePlaceIds.map((placeId) =>
      getGoogleBusinessData(
        { placeId, forceRefresh: true },
        "paid",
        { reviewsTimeoutMs: refreshTimeoutMs },
      ),
    ),
  );
}

async function prewarmLowOverlapCompetitorCaches(
  competitors: Awaited<ReturnType<typeof getCompetitorsData>>["competitors"],
) {
  const config = getAuditGoogleConfig();
  const refreshTimeoutMs = Math.min(config.competitorOutscraperTimeoutMs, 45_000);
  const placeIds = uniquePlaceIds(
    competitors
      .map((item) => item.google.business.place_id)
      .filter((placeId): placeId is string => Boolean(placeId)),
  ).slice(0, 4);
  if (placeIds.length === 0) return;

  await Promise.allSettled(
    placeIds.map((placeId) =>
      getGoogleBusinessData(
        { placeId, forceRefresh: true },
        "paid",
        { reviewsTimeoutMs: refreshTimeoutMs },
      ),
    ),
  );
}

async function mergeWithPaidCache(
  primary: Awaited<ReturnType<typeof getGoogleBusinessData>>,
  discovered: AuditCompetitorsData,
): Promise<AuditCompetitorsData> {
  const mergedCompetitors = await Promise.all(
    discovered.competitors.map(async (item) => {
      const placeId = item.google.business.place_id;
      if (!placeId) return item;
      const paidCached = await readCachedAuditData(placeId, "paid").catch(
        () => null,
      );
      if (!paidCached) return item;
      return { ...item, google: paidCached };
    }),
  );

  return {
    ...discovered,
    competitors: mergedCompetitors.map((item, index) => ({
      ...item,
      rank: index + 1,
    })),
    competitor_aggregate: aggregateCompetitorStats(primary, mergedCompetitors),
    meta: {
      ...discovered.meta,
      fetched_at: new Date().toISOString(),
      tier: "paid",
    },
  };
}

function summarizeHydrationProgress(competitors: AuditCompetitor[]) {
  const hydrated_place_ids = competitors
    .filter((item) => item.google.meta.data_source === "place_details_plus_outscraper")
    .map((item) => item.google.business.place_id)
    .filter((value): value is string => Boolean(value));
  const total_competitors = competitors.length;
  const hydrated_competitors = hydrated_place_ids.length;
  return {
    status: (
      hydrated_competitors >= total_competitors ? "ready" : "hydrating"
    ) as "ready" | "hydrating",
    total_competitors,
    hydrated_competitors,
    hydrated_place_ids: Array.from(new Set(hydrated_place_ids)),
  };
}

async function hydrateCompetitorScenarioInBackground(args: {
  scenario_id: string;
  user_id: string;
  primary_place_id: string;
  current_data: AuditCompetitorsData;
}) {
  const config = getAuditGoogleConfig();
  const pending = args.current_data.competitors.filter(
    (item) => item.google.meta.data_source !== "place_details_plus_outscraper",
  );
  if (pending.length === 0) {
    await updateCompetitorScenario({
      scenario_id: args.scenario_id,
      user_id: args.user_id,
      competitors_data: args.current_data,
      status: "ready",
      total_competitors: args.current_data.competitors.length,
      hydrated_competitors: args.current_data.competitors.length,
      failed_competitors: 0,
      hydrated_place_ids: args.current_data.competitors
        .map((item) => item.google.business.place_id)
        .filter((value): value is string => Boolean(value)),
    });
    return;
  }

  const refreshedByPlaceId = new Map<string, Awaited<ReturnType<typeof getGoogleBusinessData>>>();
  const refreshResults = await Promise.allSettled(
    pending.map(async (item) => {
      const placeId = item.google.business.place_id;
      if (!placeId) return;
      const refreshed = await getGoogleBusinessData(
        { placeId, forceRefresh: true },
        "paid",
        { reviewsTimeoutMs: config.competitorOutscraperTimeoutMs },
      );
      refreshedByPlaceId.set(placeId, refreshed);
    }),
  );

  const mergedCompetitors = args.current_data.competitors.map((item, index) => {
    const placeId = item.google.business.place_id;
    const refreshed = placeId ? refreshedByPlaceId.get(placeId) : null;
    return {
      ...item,
      rank: index + 1,
      google: refreshed ?? item.google,
    };
  });
  const hydrated = summarizeHydrationProgress(mergedCompetitors);
  const failed_competitors = refreshResults.filter(
    (result) => result.status === "rejected",
  ).length;
  const status = hydrated.hydrated_competitors >= hydrated.total_competitors
    ? "ready"
    : "failed";

  const primaryPaid = await getGoogleBusinessData(
    { placeId: args.primary_place_id, forceRefresh: true },
    "paid",
  ).catch(() => null);
  const updatedData: AuditCompetitorsData = {
    ...args.current_data,
    competitors: mergedCompetitors,
    competitor_aggregate: primaryPaid
      ? aggregateCompetitorStats(primaryPaid, mergedCompetitors)
      : args.current_data.competitor_aggregate,
    meta: {
      ...args.current_data.meta,
      fetched_at: new Date().toISOString(),
      tier: "paid",
    },
  };

  await updateCompetitorScenario({
    scenario_id: args.scenario_id,
    user_id: args.user_id,
    competitors_data: updatedData,
    status,
    total_competitors: hydrated.total_competitors,
    hydrated_competitors: hydrated.hydrated_competitors,
    failed_competitors,
    hydrated_place_ids: hydrated.hydrated_place_ids,
  });
}

function uniquePlaceIds(values: string[]) {
  return Array.from(new Set(values));
}
