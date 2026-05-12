import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database, WidgetEventType } from "@/lib/database.types";

export const runtime = "nodejs";

const VALID: WidgetEventType[] = [
  "view",
  "review_click",
  "leave_own_click",
  "cta_click",
];

interface Body {
  location_id?: string;
  event_type?: string;
  origin?: string | null;
  google_review_id?: string | null;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return new NextResponse(null, { status: 400, headers: corsHeaders() });
  }

  const eventType = body.event_type as WidgetEventType | undefined;
  if (!body.location_id || !eventType || !VALID.includes(eventType)) {
    return new NextResponse(null, { status: 400, headers: corsHeaders() });
  }

  const origin = (body.origin || request.headers.get("referer") || "")
    .toString()
    .slice(0, 500) || null;

  const supabase = createServiceClient();
  const { error } = await supabase.from("widget_events").insert({
    location_id: body.location_id,
    event_type: eventType,
    origin,
    google_review_id: body.google_review_id ?? null,
    metadata: (body.metadata ??
      {}) as Database["public"]["Tables"]["widget_events"]["Insert"]["metadata"],
  });

  if (error) {
    console.error("widget_events insert failed", error);
    return new NextResponse(null, { status: 500, headers: corsHeaders() });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
  };
}
