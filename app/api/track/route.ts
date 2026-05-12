import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/database.types";

type EventType = Database["public"]["Tables"]["landing_events"]["Insert"]["event_type"];

const VALID_EVENTS = new Set<EventType>([
  "page_view",
  "language_selected",
  "question_answered",
  "draft_generated",
  "draft_regenerated",
  "draft_edited",
  "platform_clicked",
  "private_feedback_submitted",
]);

interface TrackPayload {
  location_id?: string;
  request_id?: string | null;
  event_type?: string;
  language?: string | null;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  let body: TrackPayload;
  try {
    body = (await request.json()) as TrackPayload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event_type = body.event_type as EventType | undefined;
  if (
    !body.location_id ||
    !event_type ||
    !VALID_EVENTS.has(event_type)
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent") ?? null;
  const supabase = createServiceClient();

  const { error } = await supabase.from("landing_events").insert({
    location_id: body.location_id,
    request_id: body.request_id ?? null,
    event_type,
    language: body.language ?? null,
    user_agent: userAgent,
    metadata: (body.metadata ?? {}) as Database["public"]["Tables"]["landing_events"]["Insert"]["metadata"],
  });

  // Side-effect: when a customer clicks a public CTA, mark the
  // review_request as completed so the dashboard funnel reflects it.
  // Also captures display-consent (Phase A / Session A1) on the same call so
  // the public widget can know whether this review's text is republishable.
  if (
    event_type === "platform_clicked" &&
    body.request_id &&
    typeof body.metadata?.platform === "string"
  ) {
    const platform = body.metadata.platform;
    if (
      platform === "google" ||
      platform === "yelp" ||
      platform === "custom" ||
      platform === "private_feedback"
    ) {
      const consentRaw = body.metadata?.consent_display;
      const update: Database["public"]["Tables"]["review_requests"]["Update"] = {
        completed_platform: platform,
        completed_at: new Date().toISOString(),
      };
      if (typeof consentRaw === "boolean") {
        update.consent_display = consentRaw;
      }
      await supabase
        .from("review_requests")
        .update(update)
        .eq("id", body.request_id)
        .is("completed_at", null);
    }
  }

  if (event_type === "page_view" && body.request_id) {
    await supabase
      .from("review_requests")
      .update({ clicked_at: new Date().toISOString() })
      .eq("id", body.request_id)
      .is("clicked_at", null);
  }

  if (error) {
    console.error("track insert failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
