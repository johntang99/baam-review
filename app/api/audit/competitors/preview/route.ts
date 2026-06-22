import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  BusinessHasNoReviewsError,
  BusinessNotFoundError,
  getGoogleBusinessData,
} from "@/lib/audit/google";
import { getCompetitorsData } from "@/lib/audit/competitors";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PreviewRequest {
  place_id?: string;
  service_override?: string;
  count?: number;
  radius_miles?: number;
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
    const primary = await getGoogleBusinessData({ placeId }, "free");
    const competitorsData = await getCompetitorsData(primary, "free", {
      service_override: serviceOverride,
      count: clampCount(body.count),
      radius_miles: parseRadiusMiles(body.radius_miles),
      preview_mode: true,
    });

    return NextResponse.json({
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
