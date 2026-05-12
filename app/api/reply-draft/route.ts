import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateReply, detectReviewLanguage } from "@/lib/ai/reply";

export const runtime = "nodejs";
export const maxDuration = 30;

interface DraftReplyRequest {
  review_id?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DraftReplyRequest;
  try {
    body = (await request.json()) as DraftReplyRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.review_id) {
    return NextResponse.json({ error: "review_id required" }, { status: 400 });
  }

  // RLS scopes this read to the user's account via the location join.
  const { data: review } = await supabase
    .from("google_reviews")
    .select(
      "id, rating, comment, reviewer_display_name, location_id",
    )
    .eq("id", body.review_id)
    .maybeSingle();

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // Need the location's display_name + business_type for the prompt.
  // Use the same scoped client so RLS confirms ownership a second time.
  const { data: location } = await supabase
    .from("locations")
    .select("display_name, business_type")
    .eq("id", review.location_id)
    .maybeSingle();

  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const language = detectReviewLanguage(review.comment);

  let reply: string;
  try {
    reply = await generateReply({
      location: {
        display_name: location.display_name,
        business_type: location.business_type,
      },
      inputs: {
        reviewerName: review.reviewer_display_name,
        rating: review.rating,
        comment: review.comment,
        language,
      },
    });
  } catch (e) {
    console.error("Reply draft failed", e);
    return NextResponse.json(
      { error: "Generation failed" },
      { status: 502 },
    );
  }

  // Log this as a soft analytics signal so we can later measure how often
  // owners use AI-assist for replies vs hand-writing.
  const service = createServiceClient();
  await service.from("landing_events").insert({
    location_id: review.location_id,
    event_type: "draft_generated",
    language,
    metadata: {
      surface: "reply",
      review_id: review.id,
      rating: review.rating,
    },
  });

  return NextResponse.json({ reply, language });
}
