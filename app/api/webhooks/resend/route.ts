import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/database.types";

type RRUpdate = Database["public"]["Tables"]["review_requests"]["Update"];

/**
 * Resend webhook handler. Resend events of interest:
 *   - email.delivered → set delivered_at
 *   - email.opened → set opened_at
 *
 * Resend payload shape (Svix-delivered):
 *   { type: 'email.delivered', data: { email_id, to: ['user@example.com'], ... } }
 *
 * Signature verification (Svix headers): defer until production. For now,
 * tolerate unsigned requests so local testing is easy.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    type?: string;
    data?: { email_id?: string; to?: string[] };
  } | null;

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
