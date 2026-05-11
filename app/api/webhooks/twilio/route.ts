import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/database.types";

type RRUpdate = Database["public"]["Tables"]["review_requests"]["Update"];

/**
 * Twilio status callback. Twilio POSTs form-encoded data with MessageStatus
 * in {queued, sending, sent, delivered, undelivered, failed}.
 *
 * We don't verify Twilio's signature in v1 — when SMS goes live, add
 * twilio.validateRequest with TWILIO_AUTH_TOKEN. For now this endpoint is
 * tolerant: invalid bodies return 200 so Twilio doesn't retry forever.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ ok: true });

  const messageSid = formData.get("MessageSid");
  const status = formData.get("MessageStatus");
  const to = formData.get("To");

  if (typeof status !== "string" || typeof to !== "string") {
    return NextResponse.json({ ok: true });
  }

  // We don't currently persist Twilio's MessageSid back to review_requests
  // (no column for it). Match on most recent matching phone instead.
  const supabase = createServiceClient();

  const updates: RRUpdate = {};
  if (status === "delivered") {
    updates.delivered_at = new Date().toISOString();
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, sid: messageSid, status });
  }

  await supabase
    .from("review_requests")
    .update(updates)
    .eq("recipient_phone", to)
    .is("delivered_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  return NextResponse.json({ ok: true });
}
