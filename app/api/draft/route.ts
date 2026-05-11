import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateDrafts } from "@/lib/ai/draft";
import { isLanguage } from "@/lib/i18n/review";

export const runtime = "nodejs";
export const maxDuration = 30;

interface DraftRequest {
  location_id?: string;
  request_id?: string | null;
  service?: string | null;
  rating?: number;
  descriptor?: string | null;
  note?: string | null;
  language?: string;
  regenerate?: boolean;
}

export async function POST(request: NextRequest) {
  let body: DraftRequest;
  try {
    body = (await request.json()) as DraftRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.location_id) {
    return NextResponse.json({ error: "location_id is required" }, { status: 400 });
  }
  if (!isLanguage(body.language)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  const language = body.language;
  const rating = typeof body.rating === "number" ? body.rating : 5;

  const supabase = createServiceClient();

  // Fetch location for context (display_name, business_type) and to validate
  // that the location actually exists. We also check account suspension.
  const { data: location } = await supabase
    .from("locations")
    .select("id, display_name, business_type, account_id")
    .eq("id", body.location_id)
    .maybeSingle();

  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("suspended_at")
    .eq("id", location.account_id)
    .maybeSingle();

  if (account?.suspended_at) {
    return NextResponse.json(
      { error: "This account is currently suspended" },
      { status: 403 },
    );
  }

  // Validate request_id if supplied: must belong to this location.
  let requestId: string | null = null;
  if (body.request_id) {
    const { data: r } = await supabase
      .from("review_requests")
      .select("id, location_id")
      .eq("id", body.request_id)
      .maybeSingle();
    if (r && r.location_id === location.id) requestId = r.id;
  }

  let drafts;
  try {
    drafts = await generateDrafts({
      location: {
        display_name: location.display_name,
        business_type: location.business_type,
      },
      language,
      inputs: {
        service: body.service ?? null,
        rating,
        descriptor: body.descriptor ?? null,
        note: body.note ?? null,
      },
    });
  } catch (e) {
    console.error("Draft generation failed", e);
    return NextResponse.json(
      { error: "Generation failed" },
      { status: 502 },
    );
  }

  // Track in analytics + mark on review_request.
  const eventType = body.regenerate ? "draft_regenerated" : "draft_generated";
  await supabase.from("landing_events").insert({
    location_id: location.id,
    request_id: requestId,
    event_type: eventType,
    language,
    metadata: {
      service: body.service ?? null,
      rating,
      descriptor: body.descriptor ?? null,
      draft_count: drafts.length,
    },
  });

  if (requestId && !body.regenerate) {
    await supabase
      .from("review_requests")
      .update({ draft_generated_at: new Date().toISOString() })
      .eq("id", requestId)
      .is("draft_generated_at", null);
  }

  return NextResponse.json({ drafts });
}
