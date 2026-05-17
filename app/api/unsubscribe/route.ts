import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Public unsubscribe endpoint for review-request emails.
 *
 * Wired into the List-Unsubscribe / List-Unsubscribe-Post headers set by
 * the send action. Gmail/Yahoo bulk-sender rules (Feb 2024) require a
 * working one-click unsubscribe; its absence is a strong spam signal.
 *
 *   POST ?t=<tracking_token>  → RFC 8058 one-click. Suppress + 200, always.
 *   GET  ?t=<tracking_token>  → human clicked the link. Suppress + show a
 *                               minimal confirmation page.
 *
 * "Suppress" = upsert into opt_outs (same shape track.ts uses on bounce),
 * so the send action's pre-send opt_outs check will skip this contact and
 * future list imports auto-exclude it.
 */

async function suppress(token: string | null): Promise<boolean> {
  if (!token) return false;
  const supabase = createServiceClient();

  const { data: rr } = await supabase
    .from("review_requests")
    .select("location_id, recipient_email, recipient_phone, channel")
    .eq("tracking_token", token)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!rr) return false;

  const channel = rr.channel === "sms" ? "sms" : "email";
  const contact =
    channel === "sms" ? rr.recipient_phone : rr.recipient_email;
  if (!contact) return false;

  await supabase.from("opt_outs").upsert(
    { location_id: rr.location_id, contact, channel },
    { onConflict: "location_id,contact", ignoreDuplicates: true },
  );
  return true;
}

export async function POST(request: NextRequest) {
  // One-click: must respond 200 quickly regardless of outcome (a non-200
  // makes Gmail/Yahoo distrust the unsubscribe and hurts reputation).
  const token = request.nextUrl.searchParams.get("t");
  try {
    await suppress(token);
  } catch {
    // swallow — never fail a one-click unsubscribe
  }
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t");
  let done = false;
  try {
    done = await suppress(token);
  } catch {
    done = false;
  }

  const message = done
    ? "You've been unsubscribed. You won't receive review requests from this business again."
    : "This unsubscribe link is no longer valid, but you can reply to the original email to opt out and we'll take care of it.";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Unsubscribe</title>
  </head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1A1F1C;line-height:1.55;max-width:520px;margin:64px auto;padding:0 20px;">
    <h1 style="font-size:20px;margin:0 0 12px;">Unsubscribe</h1>
    <p style="margin:0;color:#5A6660;">${message}</p>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
