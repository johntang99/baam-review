import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifySvixSignature } from "@/lib/messaging/svix-verify";
import { recordListLifecycle, type LifecycleEvent } from "@/lib/lists/track";
import type { Database } from "@/lib/database.types";

type RRUpdate = Database["public"]["Tables"]["review_requests"]["Update"];

/**
 * Resend webhook handler. Resend uses Svix to sign every request — when
 * RESEND_WEBHOOK_SECRET is set, we verify the svix-signature header and
 * reject unsigned/forged requests with 401. Without the secret set (local
 * dev / first deploy), we accept all requests so testing isn't blocked.
 *
 * Events handled (review_requests + linked list_customers via PG2):
 *   - email.delivered  → delivered_at ; list status → delivered
 *   - email.opened     → opened_at    ; list status → opened
 *   - email.clicked    → clicked_at   ; list status → clicked
 *   - email.bounced    → clear delivered_at ; list status → bounced,
 *                        contact suppressed in opt_outs
 *   - email.complained → same as bounced
 *
 * Payload shape:
 *   { type: 'email.delivered', data: { email_id, to: ['user@example.com'], ... } }
 */
export async function POST(request: NextRequest) {
  // Read the raw body once — verification needs the exact bytes that were
  // sent, before JSON.parse normalizes whitespace.
  const rawBody = await request.text();

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const ok = verifySvixSignature({
      secret,
      svixId: request.headers.get("svix-id"),
      svixTimestamp: request.headers.get("svix-timestamp"),
      svixSignature: request.headers.get("svix-signature"),
      body: rawBody,
    });
    if (!ok) {
      console.warn("Resend webhook signature verification failed");
      return new Response("Invalid signature", { status: 401 });
    }
  }

  let body: { type?: string; data?: { email_id?: string; to?: string[] } } | null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (!body || !body.type || !body.data) {
    return NextResponse.json({ ok: true });
  }

  const recipient = body.data.to?.[0];
  if (!recipient) return NextResponse.json({ ok: true });

  const now = new Date().toISOString();
  const updates: RRUpdate = {};
  // List lifecycle event to mirror onto the linked list_customer (PG2).
  let lifecycle: LifecycleEvent | null = null;

  if (body.type === "email.delivered") {
    updates.delivered_at = now;
    lifecycle = "delivered";
  } else if (body.type === "email.opened") {
    updates.opened_at = now;
    lifecycle = "opened";
  } else if (body.type === "email.clicked") {
    updates.clicked_at = now;
    lifecycle = "clicked";
  } else if (
    body.type === "email.bounced" ||
    body.type === "email.complained"
  ) {
    // The send action sets delivered_at optimistically on a successful
    // Resend API call. If a bounce / complaint comes in later, clear it
    // so the dashboard funnel reflects reality.
    updates.delivered_at = null;
    lifecycle = "bounced";
  }

  if (Object.keys(updates).length === 0 && !lifecycle) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceClient();

  // Find the most-recent matching request so we have its id for the
  // list_customers FK join (Resend's payload carries its own email_id, not
  // our send_request_id, and v1 never persisted that — match by recipient,
  // newest-first, exactly as the v1 update did).
  const { data: rr } = await supabase
    .from("review_requests")
    .select("id")
    .eq("recipient_email", recipient)
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
        channel: "email",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
