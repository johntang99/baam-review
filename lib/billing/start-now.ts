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

  // Sign-up-first Full Service flow: if the customer was already
  // signed into BAAM Review when they hit Stripe Checkout, the start-
  // fullservice route tagged the session with signed_in_account_id.
  // Mirror the Stripe customer id onto the account so the customer's
  // dashboard shows their trial state immediately (no manual
  // reconciliation needed). Best-effort: if the account is gone we
  // still keep the customer_records row so staff can match by email.
  const signedInAccountId = session.metadata?.signed_in_account_id;
  if (signedInAccountId) {
    await service
      .from("accounts")
      .update({
        stripe_customer_id: customerId,
        subscription_status: "trialing",
        subscription_tier: "trial",
      })
      .eq("id", signedInAccountId);
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
    "     https://baamreview.com/app/onboarding",
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

/* ─────────────────────────────────────────────────────────────────────────
 * Self-Service per-location billing — welcome + team notify emails.
 *
 * Fires when the user completes Stripe Checkout from the per-location
 * "Set up billing" modal on /app/billing. Unlike Full Service, BAAM
 * doesn't connect a GBP — the customer already did. So this email
 * skips the manager-invite instructions and just confirms the trial +
 * points to the next dashboard actions.
 *
 * Idempotency: the location_subscriptions row gains a
 * welcome_email_sent_at timestamp on the first successful send. Both
 * the Stripe webhook and the post-checkout reconcile call this; the
 * timestamp prevents duplicate emails when they race.
 * ──────────────────────────────────────────────────────────────────────── */
export async function handleSelfServiceLocationCheckoutSession(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
): Promise<void> {
  const subRef = session.subscription;
  if (!subRef) return;
  const subscriptionId =
    typeof subRef === "string" ? subRef : subRef.id;

  const locationId = session.metadata?.location_id;
  const accountId = session.metadata?.account_id;
  if (!locationId || !accountId) return;

  const email =
    session.customer_details?.email ?? session.customer_email ?? "";
  if (!email) return;

  const service = createServiceClient();

  // Idempotency: check the welcome_email_sent_at marker on the
  // location_subscriptions row. If already set, bail without re-sending.
  // The row is created by applyStripeSubscription before this runs (both
  // webhook and reconcile call applyStripeSubscription first).
  const { data: existingSub } = await service
    .from("location_subscriptions")
    .select("id, welcome_email_sent_at")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (!existingSub) {
    // applyStripeSubscription hasn't created the row yet — bail. The
    // caller race will resolve and one of the two paths (webhook /
    // reconcile) will retry after the row lands.
    console.warn(
      "[selfservice email] subscription row not found yet, skipping",
      subscriptionId,
    );
    return;
  }

  if (existingSub.welcome_email_sent_at) {
    return;
  }

  const { data: loc } = await service
    .from("locations")
    .select("display_name, slug, id")
    .eq("id", locationId)
    .maybeSingle();

  const locationName = loc?.display_name ?? "your location";
  const firstName =
    session.customer_details?.name?.trim().split(/\s+/)[0] ||
    email.split("@")[0].split(/[._-]/)[0] ||
    "there";

  let trialEndIso: string | null = null;
  let customerId: string | null = null;
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    trialEndIso = sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : null;
    customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  } catch (e) {
    console.warn(
      "[selfservice email] could not retrieve subscription detail",
      e,
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://baamreview.com";

  try {
    await Promise.all([
      sendSelfServiceCustomerWelcome({
        to: email,
        firstName,
        locationName,
        trialEndIso,
        appUrl,
        locationId: loc?.id ?? locationId,
      }),
      sendSelfServiceTeamNotify({
        email,
        locationName,
        accountId,
        subscriptionId,
        customerId,
        trialEndIso,
      }),
    ]);
  } catch (e) {
    console.warn("[selfservice email] send failed", e);
    // Don't set the marker if sending failed, so the next call retries.
    return;
  }

  await service
    .from("location_subscriptions")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", existingSub.id);
}

async function sendSelfServiceCustomerWelcome(opts: {
  to: string;
  firstName: string;
  locationName: string;
  trialEndIso: string | null;
  appUrl: string;
  locationId: string;
}) {
  const from = process.env.RESEND_FROM;
  if (!from) return;

  const trialLine = opts.trialEndIso
    ? formatDate(opts.trialEndIso)
    : "30 days from today";

  const lines = [
    `Hi ${opts.firstName},`,
    "",
    `Thanks for setting up billing for ${opts.locationName}.`,
    `Your 30-day trial has started — we don't charge until ${trialLine}.`,
    "",
    "You're all set. Two things to try first:",
    "",
    `  1. Send your first review request:`,
    `     ${opts.appUrl}/app/send`,
    "",
    `  2. Print a QR poster for your shop:`,
    `     ${opts.appUrl}/app/locations/${opts.locationId}/qr`,
    "",
    "Reply anytime if you have questions — this is a real inbox.",
    "",
    "— The BAAM Review team",
  ];

  const text = lines.join("\n");
  await sendEmailViaResend({
    to: opts.to,
    subject: "Your BAAM Review trial is live",
    text,
    html: textToHtml(text),
    replyTo: TEAM_NOTIFY_EMAIL,
    from,
  });
}

async function sendSelfServiceTeamNotify(opts: {
  email: string;
  locationName: string;
  accountId: string;
  subscriptionId: string;
  customerId: string | null;
  trialEndIso: string | null;
}) {
  const from = process.env.RESEND_FROM;
  if (!from) return;

  const trialLine = opts.trialEndIso
    ? formatDate(opts.trialEndIso)
    : "unknown";

  const lines = [
    `🟢 Self-Service location billing started`,
    "",
    `Location:        ${opts.locationName}`,
    `Account ID:      ${opts.accountId}`,
    `Email:           ${opts.email}`,
    `Stripe sub:      ${opts.subscriptionId}`,
    `Stripe customer: ${opts.customerId ?? "—"}`,
    `Trial ends:      ${trialLine}`,
    "",
    "No staff action required — customer self-serves from here.",
  ];

  const text = lines.join("\n");
  await sendEmailViaResend({
    to: TEAM_NOTIFY_EMAIL,
    subject: `🟢 Self-Service billing — ${opts.locationName}`,
    text,
    html: `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre-wrap;line-height:1.55">${escapeHtml(text)}</pre>`,
    replyTo: opts.email,
    from,
  });
}
