import "server-only";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmailViaResend } from "@/lib/messaging/resend";

/**
 * Address used as the GBP manager invite target. Customer adds this email
 * as a Manager on their Google Business Profile so BAAM staff can connect
 * the GBP from within the admin without needing the customer's password.
 */
export const GBP_MANAGER_EMAIL = "baamplatform@gmail.com";

/** Where internal team notifications go (same inbox for now). */
const TEAM_NOTIFY_EMAIL = "baamplatform@gmail.com";

interface StartNowSessionData {
  email: string;
  firstName: string;
  customerName: string | null;
  businessName: string | null;
  businessAddress: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  trialEndIso: string | null;
}

/**
 * Handle a Stripe Checkout completed session that came from the Start Now
 * flow. Idempotent: re-running with the same subscription_id is a no-op.
 *
 *   1. Insert customer_records row (or skip if already exists)
 *   2. Fire 2 best-effort emails (customer welcome + team notification)
 */
export async function handleStartNowCheckoutSession(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
): Promise<void> {
  const subRef = session.subscription;
  if (!subRef) {
    console.warn("Start Now session missing subscription", session.id);
    return;
  }
  const subscriptionId =
    typeof subRef === "string" ? subRef : subRef.id;

  const customerRef = session.customer;
  if (!customerRef) {
    console.warn("Start Now session missing customer", session.id);
    return;
  }
  const customerId =
    typeof customerRef === "string" ? customerRef : customerRef.id;

  const email =
    session.customer_details?.email ?? session.customer_email ?? "";
  if (!email) {
    console.warn("Start Now session missing email", session.id);
    return;
  }

  // Custom fields hold customer's own name + business name + address.
  // Stripe returns them in an array of { key, text: { value } } objects
  // when type === "text".
  const fields = session.custom_fields ?? [];
  const customerName =
    fields.find((f) => f.key === "customer_name")?.text?.value?.trim() ??
    null;
  const businessName =
    fields.find((f) => f.key === "business_name")?.text?.value ?? null;
  const businessAddress =
    fields.find((f) => f.key === "business_address")?.text?.value ?? null;

  // Prefer the explicit "Your name" custom field (the contact person) over
  // the cardholder name — they often differ for business cards. Fall back
  // to the cardholder name, then to the email handle.
  const firstName =
    customerName?.split(/\s+/)[0] ||
    session.customer_details?.name?.trim().split(/\s+/)[0] ||
    email.split("@")[0].split(/[._-]/)[0] ||
    "there";

  // Pull the trial end from the subscription itself for the welcome email.
  let trialEndIso: string | null = null;
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    trialEndIso = sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : null;
  } catch (e) {
    console.warn("Could not retrieve subscription for trial end", e);
  }

  const service = createServiceClient();

  // Idempotency — the unique constraint on stripe_subscription_id would
  // protect us anyway, but we want a clean no-op (not a 23505 error in logs).
  const { data: existing } = await service
    .from("customer_records")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (existing) {
    console.log("Start Now session already processed", subscriptionId);
    return;
  }

  const { data: inserted, error } = await service
    .from("customer_records")
    .insert({
      email,
      business_name: businessName,
      business_address: businessAddress,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      source: "start_now",
      onboarding_status: "pending_gbp_connect",
    })
    .select("id, email")
    .single();

  if (error || !inserted) {
    console.error("Failed to insert customer_record", error);
    return;
  }

  // Best-effort emails — a failed email must not roll back the insert.
  const data: StartNowSessionData = {
    email,
    firstName,
    customerName,
    businessName,
    businessAddress,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    trialEndIso,
  };

  try {
    await Promise.all([sendCustomerWelcome(data), sendTeamNotification(data)]);
  } catch (e) {
    console.warn("Start Now emails failed (record saved)", e);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * Customer welcome email — explains how to add the GBP manager.
 * ──────────────────────────────────────────────────────────────────────── */
async function sendCustomerWelcome(data: StartNowSessionData) {
  const from = process.env.RESEND_FROM;
  if (!from) return;

  const trialLine = data.trialEndIso
    ? formatDate(data.trialEndIso)
    : "30 days from today";

  const lines = [
    `Hi ${data.firstName},`,
    "",
    "Thanks for signing up for BAAM Review Full Service. Your card is saved",
    `and your 30-day free trial has started — we don't charge until ${trialLine}.`,
    "",
    "To finish setup, please add our manager email as a Manager on your",
    "Google Business Profile:",
    "",
    `   ${GBP_MANAGER_EMAIL}`,
    "",
    "How:",
    "  1. Open business.google.com and pick your business",
    "  2. Menu → Business Profile settings → People and access",
    `  3. Add → paste ${GBP_MANAGER_EMAIL} → choose Manager`,
    "  4. Send the invite",
    "",
    "We'll accept within a few hours and have your account live within a",
    "week. You'll get an email when each step is done. No password to set,",
    "no admin UI to learn — we run everything for you.",
    "",
    "Reply anytime if you have questions — this is a real inbox.",
    "",
    "— The BAAM Review team",
  ];

  const text = lines.join("\n");
  await sendEmailViaResend({
    to: data.email,
    subject: "Welcome to Full Service — one step to finish setup",
    text,
    html: textToHtml(text),
    replyTo: TEAM_NOTIFY_EMAIL,
    from,
  });
}

/* ─────────────────────────────────────────────────────────────────────────
 * Internal team notification — actionable info for staff.
 * ──────────────────────────────────────────────────────────────────────── */
async function sendTeamNotification(data: StartNowSessionData) {
  const from = process.env.RESEND_FROM;
  if (!from) return;

  const trialLine = data.trialEndIso
    ? formatDate(data.trialEndIso)
    : "unknown";

  const lines = [
    `🟢 New Full Service signup via Start Now`,
    "",
    `Contact:        ${data.customerName ?? data.firstName}`,
    `Email:          ${data.email}`,
    `Business:       ${data.businessName ?? "—"}`,
    `Address:        ${data.businessAddress ?? "—"}`,
    `Stripe sub:     ${data.stripeSubscriptionId}`,
    `Stripe customer:${data.stripeCustomerId}`,
    `Trial ends:     ${trialLine}`,
    "",
    "─────────────────────────────────────────",
    "Action needed within 7 days:",
    "",
    `  1. Wait for the customer to add ${GBP_MANAGER_EMAIL} as a Manager`,
    "     on their Google Business Profile.",
    "  2. Accept the manager invitation in our BAAM Google account.",
    "  3. Open the Onboarding queue and click 'Connect their GBP':",
    "     https://review.baamplatform.com/app/onboarding",
    "",
    "Day 5 and day 7 alerts will fire automatically if onboarding stalls.",
  ];

  const text = lines.join("\n");
  await sendEmailViaResend({
    to: TEAM_NOTIFY_EMAIL,
    subject: `🟢 Full Service signup — ${data.businessName ?? data.firstName}`,
    text,
    html: `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre-wrap;line-height:1.55">${escapeHtml(text)}</pre>`,
    replyTo: data.email,
    from,
  });
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
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
