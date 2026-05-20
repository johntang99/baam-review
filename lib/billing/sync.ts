import "server-only";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/database.types";

type AccountsUpdate = Database["public"]["Tables"]["accounts"]["Update"];
type LocationSubInsert =
  Database["public"]["Tables"]["location_subscriptions"]["Insert"];

/**
 * Shared subscription → DB persistence. Used by BOTH the Stripe webhook
 * (ongoing source of truth) and the success-redirect reconcile (so state
 * is correct immediately, and as a production safety net if a webhook is
 * delayed/missed). Idempotent: upsert by location / update by account.
 */

// accounts.subscription_status CHECK only allows this set (0001/0022);
// map Stripe's wider status set onto it.
export function mapStatus(
  s: Stripe.Subscription.Status,
): "trialing" | "active" | "past_due" | "canceled" | "incomplete" {
  switch (s) {
    case "trialing":
    case "active":
    case "past_due":
    case "canceled":
    case "incomplete":
      return s;
    case "incomplete_expired":
      return "canceled";
    case "unpaid":
    case "paused":
      return "past_due";
    default:
      return "incomplete";
  }
}

function isoFromUnix(sec: number | null | undefined): string | null {
  return sec ? new Date(sec * 1000).toISOString() : null;
}

export async function applyStripeSubscription(sub: Stripe.Subscription) {
  const accountId = sub.metadata?.account_id;
  // No BAAM Review metadata → not ours (e.g. website-services product).
  if (!accountId) return;

  const locationId = sub.metadata?.location_id;
  const plan = sub.metadata?.plan;
  const interval =
    sub.metadata?.interval === "year"
      ? "year"
      : sub.metadata?.interval === "month"
        ? "month"
        : null;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const status = mapStatus(sub.status);
  const periodEnd = isoFromUnix(sub.items.data[0]?.current_period_end);
  const cancelAtPeriodEnd = sub.cancel_at_period_end === true;
  const service = createServiceClient();

  if (locationId) {
    const row: LocationSubInsert = {
      location_id: locationId,
      account_id: accountId,
      plan: plan === "full_service" ? "full_service" : "self_service",
      collection_method:
        sub.collection_method === "send_invoice" ? "invoice" : "card",
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      subscription_status: status,
      current_period_end: periodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
    };
    if (interval) row.billing_interval = interval;
    await service
      .from("location_subscriptions")
      .upsert(row, { onConflict: "location_id" });
    return;
  }

  const updates: AccountsUpdate = {
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
    subscription_status: status,
    current_period_end: periodEnd,
    cancel_at_period_end: cancelAtPeriodEnd,
  };
  if (plan === "self_service" || plan === "full_service") {
    updates.review_plan = plan;
  }
  if (interval) updates.billing_interval = interval;
  await service.from("accounts").update(updates).eq("id", accountId);
}

/**
 * Reconcile a completed Checkout Session into the DB by reading the
 * subscription straight from Stripe. Safe to call on the success redirect.
 */
export async function reconcileCheckoutSession(
  stripe: Stripe,
  sessionId: string,
): Promise<boolean> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.mode !== "subscription" || !session.subscription) return false;
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;
    const sub = await stripe.subscriptions.retrieve(subId);
    await applyStripeSubscription(sub);
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-sync every Stripe subscription we know about for an account (the
 * Self-service account base + each location subscription) straight from
 * Stripe. Called when returning from the Customer Portal so portal-driven
 * changes (cancel, card update, plan change) are reflected immediately —
 * the portal return URL carries no session id, so the checkout reconcile
 * can't cover it. Best-effort and idempotent; canceled subs are still
 * retrievable from Stripe and map to status "canceled".
 */
export async function reconcileAccountSubscriptions(
  stripe: Stripe,
  accountId: string,
): Promise<void> {
  const service = createServiceClient();

  const { data: account } = await service
    .from("accounts")
    .select("stripe_subscription_id")
    .eq("id", accountId)
    .maybeSingle();

  const { data: locSubs } = await service
    .from("location_subscriptions")
    .select("stripe_subscription_id")
    .eq("account_id", accountId);

  const subIds = [
    account?.stripe_subscription_id,
    ...(locSubs ?? []).map((s) => s.stripe_subscription_id),
  ].filter((id): id is string => !!id);

  await Promise.all(
    subIds.map(async (id) => {
      try {
        await applyStripeSubscription(
          await stripe.subscriptions.retrieve(id),
        );
      } catch {
        // skip ids Stripe no longer knows; webhook deleted-handler covers it
      }
    }),
  );
}
