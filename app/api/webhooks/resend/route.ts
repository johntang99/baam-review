import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifySvixSignature } from "@/lib/messaging/svix-verify";
import type { Database } from "@/lib/database.types";

type RRUpdate = Database["public"]["Tables"]["review_requests"]["Update"];

/**
 * Resend webhook handler. Resend uses Svix to sign every request — when
 * RESEND_WEBHOOK_SECRET is set, we verify the svix-signature header and
 * reject unsigned/forged requests with 401. Without the secret set (local
 * dev / first deploy), we accept all requests so testing isn't blocked.
 *
 * Events handled:
 *   - email.delivered → set delivered_at
 *   - email.opened    → set opened_at
 *   - email.bounced   → clear delivered_at (reverts optimistic write from
 *                       the send action)
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

  const updates: RRUpdate = {};
  if (body.type === "email.delivered") {
    updates.delivered_at = new Date().toISOString();
  } else if (body.type === "email.opened") {
    updates.opened_at = new Date().toISOString();
  } else if (
    body.type === "email.bounced" ||
    body.type === "email.complained"
  ) {
    // The send action sets delivered_at optimistically on a successful
    // Resend API call. If a bounce / complaint comes in later, clear it
    // so the dashboard funnel reflects reality.
    updates.delivered_at = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceClient();
  await supabase
    .from("review_requests")
    .update(updates)
    .eq("recipient_email", recipient)
    .order("created_at", { ascending: false })
    .limit(1);

  return NextResponse.json({ ok: true });
}
