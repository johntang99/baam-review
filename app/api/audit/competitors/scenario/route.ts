import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readCompetitorScenario } from "@/lib/audit/competitors/scenario-cache";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!auth.user.email_confirmed_at) {
    return NextResponse.json({ error: "email_not_verified" }, { status: 403 });
  }

  const url = new URL(request.url);
  const scenarioId = String(url.searchParams.get("scenario_id") ?? "").trim();
  if (!scenarioId) {
    return NextResponse.json({ error: "missing_scenario_id" }, { status: 400 });
  }

  const scenario = await readCompetitorScenario({
    scenario_id: scenarioId,
    user_id: auth.user.id,
  }).catch((err) => {
    console.error("[competitor-scenario] read failed:", err);
    return null;
  });

  if (!scenario) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const total = scenario.total_competitors;
  const cache_hits = scenario.hydrated_competitors;
  const degraded_results = scenario.failed_competitors;

  return NextResponse.json({
    scenario_id: scenario.scenario_id,
    scenario_expires_at: scenario.expires_at,
    generated_at: scenario.updated_at || scenario.created_at,
    service_override: scenario.service_override,
    status: scenario.status,
    total_competitors: scenario.total_competitors,
    hydrated_competitors: scenario.hydrated_competitors,
    failed_competitors: scenario.failed_competitors,
    cache_stats: {
      total,
      cache_hits,
      cache_misses: Math.max(0, total - cache_hits),
      degraded_results,
      cache_hit_ratio_pct: total > 0 ? Math.round((cache_hits / total) * 100) : 0,
    },
    search_metadata: scenario.competitors_data.search_metadata,
    competitors: scenario.competitors_data.competitors.map((item) => ({
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
}
