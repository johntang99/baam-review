import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/billing/stripe";
import { applyStripeSubscription } from "@/lib/billing/sync";

/**
 * Stripe webhook for BAAM Review billing. Verifies the signature when
 * STRIPE_WEBHOOK_SECRET is set; without it, accepts in dev so local
 * testing isn't blocked. Only events carrying our metadata.account_id are
 * acted on. Persistence is shared with the success-redirect reconcile via
 * lib/billing/sync (so a delayed/missed webhook can't leave the UI stale).
 *
 *   checkout.session.completed                    → link sub
 *   customer.subscription.created / .updated      → status/interval/period
 *   customer.subscription.deleted                 → clear (account or loc)
 *
 * Failed payments arrive as customer.subscription.updated (past_due).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();

  let event: Stripe.Event;
  if (secret) {
    const sig = request.headers.get("stripe-signature");
    if (!sig) return new Response("Missing signature", { status: 401 });
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    } catch {
      console.warn("Stripe webhook signature verification failed");
      return new Response("Invalid signature", { status: 401 });
    }
  } else {
    try {
      event = JSON.parse(rawBody) as Stripe.Event;
    } catch {
      return NextResponse.json({ received: true });
    }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        await applyStripeSubscription(
          await stripe.subscriptions.retrieve(subId),
        );
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await applyStripeSubscription(
          event.data.object as Stripe.Subscription,
        );
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const accountId = sub.metadata?.account_id;
        const locationId = sub.metadata?.location_id;
        if (!accountId) break;
        const service = createServiceClient();
        if (locationId) {
          await service
            .from("location_subscriptions")
            .update({
              subscription_status: "canceled",
              stripe_subscription_id: null,
              cancel_at_period_end: false,
            })
            .eq("location_id", locationId);
        } else {
          await service
            .from("accounts")
            .update({
              subscription_status: "canceled",
              stripe_subscription_id: null,
              review_plan: null,
              cancel_at_period_end: false,
            })
            .eq("id", accountId);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    // Log but still 200 — Stripe retries on non-2xx; idempotent writes
    // make retries safe.
    console.error("Stripe webhook handler error", event.type, e);
  }

  return NextResponse.json({ received: true });
}
