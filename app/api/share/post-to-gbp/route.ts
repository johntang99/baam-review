import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getValidAccessToken } from "@/lib/google/business-profile";
import { createLocalPost } from "@/lib/google/local-posts";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  google_review_id?: string;
  caption?: string;
  theme?: string;
  /** "og" or "square" — GBP renders best at landscape (OG) or square. */
  size?: "og" | "square";
  /** Optional CTA button on the post. */
  cta?: {
    type: "BOOK" | "ORDER" | "LEARN_MORE" | "CALL";
    url?: string;
  };
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

  if (!body.google_review_id || !body.caption) {
    return NextResponse.json(
      { error: "google_review_id and caption required" },
      { status: 400 },
    );
  }

  const theme = typeof body.theme === "string" ? body.theme : "warm-clinic";
  const size: "og" | "square" = body.size === "square" ? "square" : "og";

  // Look up the review's location (RLS-scoped via authenticated client).
  const { data: review } = await supabase
    .from("google_reviews")
    .select("google_review_id, location_id")
    .eq("google_review_id", body.google_review_id)
    .maybeSingle();
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const { data: location } = await supabase
    .from("locations")
    .select("id, account_id, google_resource_name, booking_url")
    .eq("id", review.location_id)
    .maybeSingle();
  if (!location || !location.google_resource_name) {
    return NextResponse.json(
      { error: "Location is not connected to Google Business Profile" },
      { status: 400 },
    );
  }

  // Exchange refresh token for a current access token.
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(location.account_id);
  } catch {
    return NextResponse.json(
      { error: "Google authorization expired — reconnect in Settings" },
      { status: 401 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://review.baamplatform.com";
  const mediaUrl = `${baseUrl}/og/review/${review.google_review_id}?size=${size}&theme=${encodeURIComponent(theme)}`;

  const cta = body.cta ?? (location.booking_url
    ? { type: "BOOK" as const, url: location.booking_url }
    : undefined);

  try {
    const result = await createLocalPost({
      accessToken,
      locationResourceName: location.google_resource_name,
      summary: body.caption,
      media: [{ sourceUrl: mediaUrl }],
      callToAction: cta && cta.type === "CALL"
        ? { actionType: "CALL" }
        : cta && cta.url
          ? { actionType: cta.type, url: cta.url }
          : undefined,
    });

    // Telemetry — record the post.
    const service = createServiceClient();
    await service.from("social_graphics").insert({
      location_id: location.id,
      google_review_id: review.google_review_id,
      size: size,
      theme,
      action: "open",
      metadata: { posted_to: "gbp", post_name: result.name, state: result.state },
    });

    return NextResponse.json({
      ok: true,
      post: { name: result.name, state: result.state, searchUrl: result.searchUrl },
    });
  } catch (e) {
    console.error("GBP local-post create failed", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "GBP post failed",
      },
      { status: 502 },
    );
  }
}
