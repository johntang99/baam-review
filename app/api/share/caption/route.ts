import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateSocialCaption,
  type CaptionPlatform,
} from "@/lib/ai/social-caption";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_PLATFORMS: CaptionPlatform[] = [
  "instagram",
  "facebook",
  "twitter",
  "linkedin",
];

interface Body {
  google_review_id?: string;
  platform?: string;
  language?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const platform = (body.platform ?? "instagram") as CaptionPlatform;
  if (!VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }
  const language: "en" | "zh" | "es" =
    body.language === "zh" || body.language === "es" ? body.language : "en";

  if (!body.google_review_id) {
    return NextResponse.json(
      { error: "google_review_id required" },
      { status: 400 },
    );
  }

  // RLS scopes both reads to the user's account.
  const { data: review } = await supabase
    .from("google_reviews")
    .select(
      "id, google_review_id, reviewer_display_name, rating, comment, location_id",
    )
    .eq("google_review_id", body.google_review_id)
    .maybeSingle();
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const { data: location } = await supabase
    .from("locations")
    .select("display_name, business_type, booking_url")
    .eq("id", review.location_id)
    .maybeSingle();
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  try {
    const result = await generateSocialCaption({
      reviewerName: review.reviewer_display_name,
      rating: review.rating,
      comment: review.comment,
      language,
      platform,
      locationName: location.display_name,
      businessType: location.business_type,
      bookingUrl: location.booking_url,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("Caption generation failed", e);
    return NextResponse.json(
      { error: "Caption generation failed" },
      { status: 502 },
    );
  }
}
