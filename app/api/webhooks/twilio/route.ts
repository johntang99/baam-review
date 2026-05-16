import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordListLifecycle } from "@/lib/lists/track";
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
  // SMS has no 'opened'/'clicked' tracking (plan §5). Delivery is the only
  // lifecycle signal Twilio's status callback gives us. Undelivered/failed
  // are treated as a bounce equivalent for the list (suppress + mark).
  let lifecycle: "delivered" | "bounced" | null = null;
  if (status === "delivered") {
    updates.delivered_at = new Date().toISOString();
    lifecycle = "delivered";
  } else if (status === "undelivered" || status === "failed") {
    updates.delivered_at = null;
    lifecycle = "bounced";
  }

  if (Object.keys(updates).length === 0 && !lifecycle) {
    return NextResponse.json({ ok: true, sid: messageSid, status });
  }

  const { data: rr } = await supabase
    .from("review_requests")
    .select("id")
    .eq("recipient_phone", to)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (rr) {
    if (Object.keys(updates).length > 0) {
      await supabase
        .from("review_requests")
        .update(updates)
        .eq("id", rr.id);
    }
    if (lifecycle) {
      await recordListLifecycle(supabase, rr.id, lifecycle, {
        channel: "sms",
      });
    }
  }

  return NextResponse.json({ ok: true, sid: messageSid, status });
}
