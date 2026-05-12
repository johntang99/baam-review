import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/database.types";

export const runtime = "nodejs";

type EventType = Database["public"]["Tables"]["referrals"]["Insert"]["event_type"];

const VALID: EventType[] = [
  "share_view",
  "booking_click",
  "open_in_maps_click",
  "leave_own_click",
  "review_started",
  "review_submitted",
];

interface Body {
  location_id?: string;
  advocate_request_id?: string | null;
  event_type?: string;
  conversion_request_id?: string | null;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const eventType = body.event_type as EventType | undefined;
  if (!body.location_id || !eventType || !VALID.includes(eventType)) {
    return new NextResponse(null, { status: 400 });
  }

  const referer = request.headers.get("referer");
  let referrerHost: string | null = null;
  if (referer) {
    try {
      referrerHost = new URL(referer).hostname.slice(0, 200);
    } catch {
      referrerHost = null;
    }
  }
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  const supabase = createServiceClient();
  const { error } = await supabase.from("referrals").insert({
    location_id: body.location_id,
    advocate_request_id: body.advocate_request_id ?? null,
    event_type: eventType,
    conversion_request_id: body.conversion_request_id ?? null,
    referrer_host: referrerHost,
    user_agent: userAgent,
    metadata: (body.metadata ??
      {}) as Database["public"]["Tables"]["referrals"]["Insert"]["metadata"],
  });

  if (error) {
    console.error("referrals insert failed", error);
    return new NextResponse(null, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
