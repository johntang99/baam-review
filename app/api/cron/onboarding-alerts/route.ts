import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmailViaResend } from "@/lib/messaging/resend";
import { GBP_MANAGER_EMAIL } from "@/lib/billing/start-now";

/**
 * Vercel Cron entry point. Configured in vercel.json to run once daily.
 *
 * Scans customer_records still in pending_gbp_connect and fires alerts
 * at days 5 and 7. Day 5 is a gentle nudge to the customer; day 7 is
 * an urgent internal-team escalation (we're already paying for their
 * trial day, and they're not connected yet).
 *
 * Idempotency: we track which alerts have been sent with the
 * `last_alert_sent_day` column. Re-running the cron the same day or
 * a later day is a no-op for already-alerted records.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const TEAM_NOTIFY_EMAIL = "baamplatform@gmail.com";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const service = createServiceClient();

  const { data: pending } = await service
    .from("customer_records")
    .select(
      "id, email, business_name, business_address, stripe_subscription_id, created_at, last_alert_sent_day",
    )
    .eq("onboarding_status", "pending_gbp_connect");

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, alerts: [] });
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const alerts: Array<{
    customer_record_id: string;
    day: number;
    type: "customer_nudge" | "team_urgent";
    sent: boolean;
    error?: string;
  }> = [];

  for (const row of pending) {
    const daysOld = Math.floor(
      (now - new Date(row.created_at).getTime()) / dayMs,
    );

    let alertDay: 5 | 7 | null = null;
    if (daysOld >= 7 && (row.last_alert_sent_day ?? 0) < 7) {
      alertDay = 7;
    } else if (daysOld >= 5 && (row.last_alert_sent_day ?? 0) < 5) {
      alertDay = 5;
    }
    if (!alertDay) continue;

    try {
      if (alertDay === 5) {
        await sendCustomerNudge({
          to: row.email,
          businessName: row.business_name,
        });
        alerts.push({
          customer_record_id: row.id,
          day: 5,
          type: "customer_nudge",
          sent: true,
        });
      } else {
        await sendTeamUrgent({
          customerRecordId: row.id,
          email: row.email,
          businessName: row.business_name,
          businessAddress: row.business_address,
          stripeSubscriptionId: row.stripe_subscription_id,
          daysOld,
        });
        alerts.push({
          customer_record_id: row.id,
          day: 7,
          type: "team_urgent",
          sent: true,
        });
      }

      await service
        .from("customer_records")
        .update({
          last_alert_sent_day: alertDay,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    } catch (e) {
      alerts.push({
        customer_record_id: row.id,
        day: alertDay,
        type: alertDay === 5 ? "customer_nudge" : "team_urgent",
        sent: false,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ ok: true, scanned: pending.length, alerts });
}

async function sendCustomerNudge(opts: {
  to: string;
  businessName: string | null;
}) {
  const from = process.env.RESEND_FROM;
  if (!from) return;

  const greeting = opts.businessName
    ? `Hi — checking in about ${opts.businessName}.`
    : "Hi — checking in.";

  const lines = [
    greeting,
    "",
    "You signed up for BAAM Review Full Service a few days ago, but we",
    "haven't received the Google Business Profile manager invite yet.",
    "Without it we can't connect your account or start sending review",
    "requests — and your free trial keeps counting down.",
    "",
    `The one thing we need is this email added as a Manager on your GBP:`,
    "",
    `   ${GBP_MANAGER_EMAIL}`,
    "",
    "How:",
    "  1. Open business.google.com and pick your business",
    "  2. Menu → Business Profile settings → People and access",
    `  3. Add → paste ${GBP_MANAGER_EMAIL} → choose Manager → Send`,
    "",
    "Stuck on a step? Reply to this email with a screenshot — we'll send",
    "exact instructions. Or write to support@baamplatform.com.",
    "",
    "— The BAAM Review team",
  ];

  const text = lines.join("\n");
  await sendEmailViaResend({
    to: opts.to,
    subject: "Quick check-in — one step to finish your setup",
    text,
    html: textToHtml(text),
    replyTo: TEAM_NOTIFY_EMAIL,
    from,
  });
}

async function sendTeamUrgent(opts: {
  customerRecordId: string;
  email: string;
  businessName: string | null;
  businessAddress: string | null;
  stripeSubscriptionId: string;
  daysOld: number;
}) {
  const from = process.env.RESEND_FROM;
  if (!from) return;

  const lines = [
    `🔴 URGENT — customer stalled at ${opts.daysOld} days, no GBP invite`,
    "",
    `Email:        ${opts.email}`,
    `Business:     ${opts.businessName ?? "—"}`,
    `Address:      ${opts.businessAddress ?? "—"}`,
    `Stripe sub:   ${opts.stripeSubscriptionId}`,
    `Days stalled: ${opts.daysOld}`,
    "",
    "─────────────────────────────────────────",
    "Action needed today:",
    "",
    "  1. Email the customer directly (not via Resend). Offer screenshare",
    "     or do-it-for-them via a screenshot walkthrough.",
    "  2. If no reply within 48 h, consider pausing the trial in Stripe so",
    "     they aren't charged on day 30 without service.",
    "",
    `Open queue: https://review.baamplatform.com/app/onboarding`,
  ];

  const text = lines.join("\n");
  await sendEmailViaResend({
    to: TEAM_NOTIFY_EMAIL,
    subject: `🔴 Stalled onboarding — ${opts.businessName ?? opts.email} (day ${opts.daysOld})`,
    text,
    html: `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre-wrap;line-height:1.55">${escapeHtml(text)}</pre>`,
    replyTo: opts.email,
    from,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function textToHtml(text: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:14px;line-height:1.65;color:#1A1F1C;max-width:560px">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`;
}
