import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  BusinessHasNoReviewsError,
  BusinessNotFoundError,
  getGoogleBusinessData,
} from "@/lib/audit/google";
import { resolveServiceKeyword } from "@/lib/audit/competitors/keyword-resolver";
import { VERTICAL_KEYS } from "@/lib/audit/google/types";
import type { VerticalKey } from "@/lib/audit/google/types";

export const runtime = "nodejs";
export const maxDuration = 30;

interface ResolveRequest {
  name?: string;
  address?: string;
  website?: string;
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

  let body: ResolveRequest;
  try {
    body = (await request.json()) as ResolveRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const address = (body.address ?? "").trim();
  if (!name || !address) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const textQuery = `${name} ${address}`;

  try {
    const google = await getGoogleBusinessData({ textQuery }, "free");
    const detectedVertical: VerticalKey = google.vertical.inferred_vertical;
    const detectedService = resolveServiceKeyword(google);
    const websiteMatch = matchWebsite(body.website, google.business.website);

    return NextResponse.json({
      place_id: google.business.place_id,
      name: google.business.name,
      name_secondary: google.business.name_secondary ?? null,
      formatted_address: google.business.formatted_address,
      city: google.business.city,
      state: google.business.state,
      zip: google.business.zip,
      website_on_google: google.business.website ?? null,
      rating: google.reviews_aggregate.rating,
      total_count: google.reviews_aggregate.total_count,
      last_review_days_ago: google.reviews_aggregate.last_review_days_ago,
      is_chinese_business: google.language.is_chinese_business,
      detected_vertical: detectedVertical,
      detected_service: detectedService,
      vertical_options: VERTICAL_KEYS,
      website_match: websiteMatch,
    });
  } catch (err) {
    if (err instanceof BusinessNotFoundError) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (err instanceof BusinessHasNoReviewsError) {
      return NextResponse.json({ error: "NO_REVIEWS" }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[resolve] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function matchWebsite(
  user: string | undefined,
  google: string | undefined | null,
): "match" | "mismatch" | "no_user_input" | "no_google_data" {
  const u = (user ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const g = (google ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!u) return "no_user_input";
  if (!g) return "no_google_data";
  const userHost = u.replace(/^www\./, "").split("/")[0];
  const googleHost = g.replace(/^www\./, "").split("/")[0];
  return userHost === googleHost ? "match" : "mismatch";
}
