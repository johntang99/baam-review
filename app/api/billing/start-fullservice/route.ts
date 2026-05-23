/**
 * POST /api/billing/start-fullservice
 *
 * Creates a Stripe Checkout session for the "Start Now" Full Service flow.
 * Customer pays nothing today — card is saved, subscription created with a
 * 30-day trial. Webhook handler at /api/webhooks/stripe later creates a
 * customer_records row from the completed session.
 *
 * Custom fields: business_name + business_address (Stripe supports up to
 * 2 of them on Checkout). We use both so staff can later match the right
 * GBP to the customer record.
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

  // Build absolute URLs for Stripe's success/cancel redirects.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "review.baamplatform.com";
  const origin = `${proto}://${host}`;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],

    // The 30-day trial: card is saved, customer not charged until day 31.
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { baam_review_source: "start_now_fullservice" },
    },

    // Tag the session itself so the webhook can branch on this without
    // having to query the subscription separately.
    metadata: { source: "start_now_fullservice", interval },

    // Stripe collects email natively; the two custom fields cover the
    // business-info we need to match the right GBP to this payment later.
    custom_fields: [
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
