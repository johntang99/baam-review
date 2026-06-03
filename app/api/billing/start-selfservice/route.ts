/**
 * POST /api/billing/start-selfservice
 *
 * Self-Serve checkout — mirror of /api/billing/start-fullservice, but uses
 * the SELF_BASE Stripe Price ($99/mo, $990/yr) and a different metadata
 * source tag so the webhook handler can branch correctly.
 *
 * Same 30-day trial, same custom_fields (customer/business name, address),
 * same return URLs based on signed-in state. Returns `{ url }` for the
 * client to do `window.location = url`.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe, resolvePriceId } from "@/lib/billing/stripe";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface StartSelfServiceBody {
  interval?: "month" | "year";
}

export async function POST(request: Request) {
  let body: StartSelfServiceBody = {};
  try {
    body = (await request.json()) as StartSelfServiceBody;
  } catch {
    // Empty body is fine.
  }

  const interval = body.interval === "year" ? "year" : "month";
  const priceId = resolvePriceId("self_service", "base", interval);

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

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "baamreview.com";
  const origin = `${proto}://${host}`;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],

    ...(user?.email ? { customer_email: user.email } : {}),

    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: {
        baam_review_source: "start_now_selfservice",
        ...(accountId ? { signed_in_account_id: accountId } : {}),
      },
    },

    metadata: {
      source: "start_now_selfservice",
      interval,
      ...(accountId ? { signed_in_account_id: accountId } : {}),
    },

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

    allow_promotion_codes: true,
    billing_address_collection: "auto",

    success_url: user
      ? `${origin}/app/billing?status=success&session_id={CHECKOUT_SESSION_ID}`
      : `${origin}/start/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: user
      ? `${origin}/app/billing?status=cancelled`
      : `${origin}/pricing#plans`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a Checkout URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
