/**
 * POST /api/billing/start-fullservice
 *
 * Creates a Stripe Checkout session for the "Start Now" Full Service flow.
 * Customer pays nothing today — card is saved, subscription created with a
 * 30-day trial. Webhook handler at /api/webhooks/stripe later creates a
 * customer_records row from the completed session.
 *
 * Custom fields: customer_name + business_name + business_address.
 * Stripe Checkout allows up to 3 custom_fields per session and that's
 * exactly what we use. customer_name is the contact person (often
 * different from the cardholder name when paying with a business card),
 * the other two let staff match the right GBP to the customer record.
 *
 * Session metadata: source=start_now_fullservice — webhook uses this to
 * branch into the right handler.
 *
 * Returns: { url: string } — the hosted Stripe Checkout URL. Caller (the
 * marketing page button) does window.location = url.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe, resolvePriceId } from "@/lib/billing/stripe";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface StartFullServiceBody {
  /** Annual vs monthly. Defaults to monthly. */
  interval?: "month" | "year";
}

export async function POST(request: Request) {
  let body: StartFullServiceBody = {};
  try {
    body = (await request.json()) as StartFullServiceBody;
  } catch {
    // Empty body is fine — interval defaults below.
  }

  const interval = body.interval === "year" ? "year" : "month";

  // Pull the right Stripe Price ID. FULL_BASE handles every Full Service
  // location regardless of count.
  const priceId = resolvePriceId("full_service", "base", interval);

  // If the request comes from a signed-in user, pre-fill the Stripe email
  // and tag the session with the account_id so the webhook can link the
  // resulting customer_records row to that account without manual
  // reconciliation. Anonymous Start-Now traffic still works — the email
  // and metadata fields just go un-prefilled.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let accountId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("account_id")
      .eq("id", user.id)
      .maybeSingle();
    accountId = profile?.account_id ?? null;
  }

  // Build absolute URLs for Stripe's success/cancel redirects.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "review.baamplatform.com";
  const origin = `${proto}://${host}`;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],

    // Pre-fill email + tag the session for signed-in users so the
    // post-payment welcome email and Stripe receipts both reach a
    // verified address (avoids the typo'd-email failure mode).
    ...(user?.email ? { customer_email: user.email } : {}),

    // The 30-day trial: card is saved, customer not charged until day 31.
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: {
        baam_review_source: "start_now_fullservice",
        ...(accountId ? { signed_in_account_id: accountId } : {}),
      },
    },

    // Tag the session itself so the webhook can branch on this without
    // having to query the subscription separately.
    metadata: {
      source: "start_now_fullservice",
      interval,
      ...(accountId ? { signed_in_account_id: accountId } : {}),
    },

    // Stripe collects email + cardholder name natively. We additionally
    // collect the customer's own name (separate from the cardholder, which
    // for business cards is often the company name) plus the business
    // identity fields. Order here is the display order in Checkout.
    custom_fields: [
      {
        key: "customer_name",
        label: { type: "custom", custom: "Your name" },
        type: "text",
        text: { minimum_length: 2, maximum_length: 80 },
      },
      {
        key: "business_name",
        label: { type: "custom", custom: "Business name" },
        type: "text",
        text: { minimum_length: 2, maximum_length: 120 },
      },
      {
        key: "business_address",
        label: { type: "custom", custom: "Business address" },
        type: "text",
        text: { minimum_length: 4, maximum_length: 240 },
      },
    ],

    // Discount codes available for promo runs.
    allow_promotion_codes: true,

    billing_address_collection: "auto",

    success_url: `${origin}/start/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing#plans`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a Checkout URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
