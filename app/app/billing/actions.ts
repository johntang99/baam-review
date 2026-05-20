"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getStripe,
  isStripeConfigured,
  resolvePriceId,
} from "@/lib/billing/stripe";
import {
  PLAN_HAS_TRIAL,
  TRIAL_DAYS,
  locationPriceRef,
  type BillingInterval,
  type ReviewPlan,
} from "@/lib/billing/plans";

export interface ActionResult {
  ok: boolean;
  url?: string;
  error?: string;
}

async function appUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.")
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4001";
}

async function currentAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/billing");
  const { data: profile } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.account_id) return null;
  const { data: account } = await supabase
    .from("accounts")
    .select(
      "id, name, primary_email, review_plan, stripe_customer_id, stripe_subscription_id",
    )
    .eq("id", profile.account_id)
    .maybeSingle();
  return account ?? null;
}

function readInterval(fd: FormData): BillingInterval {
  return fd.get("interval") === "year" ? "year" : "month";
}

/**
 * Optional staff-entered discount code (e.g. for locations already on a
 * BAAM Studio service). Resolves a human-readable Stripe promotion code to
 * its id so it can be applied to a Checkout session or subscription. The
 * coupon's amount/percent and duration (once vs forever) live on the Stripe
 * coupon — no code change needed to tune them.
 */
async function resolveDiscount(
  fd: FormData,
): Promise<
  | { ok: true; promotionCodeId: string | null }
  | { ok: false; error: string }
> {
  const code = String(fd.get("discount_code") ?? "").trim();
  if (!code) return { ok: true, promotionCodeId: null };
  const list = await getStripe().promotionCodes.list({
    code,
    active: true,
    limit: 1,
  });
  const pc = list.data[0];
  if (!pc)
    return { ok: false, error: `Discount code "${code}" is not valid.` };
  return { ok: true, promotionCodeId: pc.id };
}

/** Designate the account Self-service (no account base; per-location billing). */
export async function setSelfServiceAccount(): Promise<ActionResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: "No account." };
  await createServiceClient()
    .from("accounts")
    .update({ review_plan: "self_service" })
    .eq("id", account.id);
  revalidatePath("/app/billing");
  return { ok: true };
}

/** Designate the account Full-service (no account base; per-location billing). */
export async function setFullServiceAccount(): Promise<ActionResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: "No account." };
  await createServiceClient()
    .from("accounts")
    .update({ review_plan: "full_service" })
    .eq("id", account.id);
  revalidatePath("/app/billing");
  return { ok: true };
}

async function locationForAccount(locationId: string, accountId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("locations")
    .select("id, display_name, account_id")
    .eq("id", locationId)
    .maybeSingle();
  return data && data.account_id === accountId ? data : null;
}

const LIVE_SUB_STATUSES = ["trialing", "active", "past_due"];

/**
 * Guard against creating a SECOND Stripe subscription for a location that
 * already has a live one (which would double-bill — each setup also makes
 * its own Stripe customer). Staff should use "Manage" (Customer Portal)
 * instead. A canceled/absent row is fine to set up again.
 */
async function locationHasLiveSub(locationId: string): Promise<boolean> {
  const { data } = await createServiceClient()
    .from("location_subscriptions")
    .select("subscription_status, stripe_subscription_id")
    .eq("location_id", locationId)
    .maybeSingle();
  if (!data?.stripe_subscription_id) return false;
  return LIVE_SUB_STATUSES.includes(data.subscription_status ?? "");
}

/**
 * Count of active/trialing/past_due location subs on the account. Used to
 * decide whether a new location is the FIRST (promotional $89 for
 * self-service) or an ADDITIONAL ($79 for self-service). Full-service is
 * flat $299 regardless, but we still count to keep the logic uniform.
 */
async function activeLocationSubCount(accountId: string): Promise<number> {
  const { count } = await createServiceClient()
    .from("location_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("account_id", accountId)
    .in("subscription_status", LIVE_SUB_STATUSES);
  return count ?? 0;
}

/**
 * Per-location CARD subscription via Checkout (its own customer/card).
 * Price tier depends on the account plan:
 *   self_service: first location $89/mo · additional $79/mo
 *   full_service: every location $299/mo (flat)
 * Every location gets a 30-day trial with card on file (no proration —
 * independent sub).
 */
export async function createLocationCheckoutSession(
  fd: FormData,
): Promise<ActionResult> {
  if (!isStripeConfigured())
    return { ok: false, error: "Billing is not configured." };
  const account = await currentAccount();
  if (!account) return { ok: false, error: "No account." };
  const plan = (account.review_plan as ReviewPlan | null) ?? null;
  if (plan !== "self_service" && plan !== "full_service")
    return { ok: false, error: "Choose a plan for the account first." };

  const locationId = String(fd.get("location_id") ?? "");
  const loc = await locationForAccount(locationId, account.id);
  if (!loc) return { ok: false, error: "Location not found." };

  const interval = readInterval(fd);
  const discount = await resolveDiscount(fd);
  if (!discount.ok) return { ok: false, error: discount.error };
  const stripe = getStripe();

  if (await locationHasLiveSub(loc.id))
    return {
      ok: false,
      error:
        "This location already has an active subscription — use Manage to change it.",
    };

  const isFirst = (await activeLocationSubCount(account.id)) === 0;
  const ref = locationPriceRef(plan, isFirst);

  // This location's OWN Stripe customer (its own card).
  const customer = await stripe.customers.create({
    name: loc.display_name ?? undefined,
    metadata: { account_id: account.id, location_id: loc.id },
  });

  const base = await appUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    line_items: [
      { price: resolvePriceId(ref.plan, ref.component, interval), quantity: 1 },
    ],
    payment_method_collection: "always",
    ...(discount.promotionCodeId
      ? { discounts: [{ promotion_code: discount.promotionCodeId }] }
      : {}),
    subscription_data: {
      ...(PLAN_HAS_TRIAL[plan] ? { trial_period_days: TRIAL_DAYS } : {}),
      metadata: {
        account_id: account.id,
        location_id: loc.id,
        plan,
        interval,
        kind: "location",
      },
    },
    metadata: {
      account_id: account.id,
      location_id: loc.id,
      plan,
      interval,
      kind: "location",
    },
    success_url: `${base}/app/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/app/billing?status=cancelled`,
  });

  // No pre-create: the webhook creates location_subscriptions on
  // checkout.session.completed / customer.subscription.created (metadata
  // carries location_id). Avoids a stale "set up" row if the user
  // abandons checkout.
  return session.url
    ? { ok: true, url: session.url }
    : { ok: false, error: "Could not start checkout." };
}

/**
 * Full-service ONLY: per-location subscription billed by INVOICE (pay by
 * check). No card, no Checkout — staff-created via the API with
 * collection_method=send_invoice, net-30. Webhook syncs status; BAAM marks
 * each invoice paid (out of band) in Stripe when the check clears.
 */
export async function createLocationInvoiceSubscription(
  fd: FormData,
): Promise<ActionResult> {
  if (!isStripeConfigured())
    return { ok: false, error: "Billing is not configured." };
  const account = await currentAccount();
  if (!account) return { ok: false, error: "No account." };
  if (account.review_plan !== "full_service")
    return {
      ok: false,
      error: "Invoice/check billing is Full-service only.",
    };

  const locationId = String(fd.get("location_id") ?? "");
  const loc = await locationForAccount(locationId, account.id);
  if (!loc) return { ok: false, error: "Location not found." };

  const interval = readInterval(fd);
  const discount = await resolveDiscount(fd);
  if (!discount.ok) return { ok: false, error: discount.error };
  const stripe = getStripe();
  const service = createServiceClient();

  if (await locationHasLiveSub(loc.id))
    return {
      ok: false,
      error:
        "This location already has an active subscription — use Manage to change it.",
    };

  // send_invoice requires a customer email (Stripe emails the invoice).
  if (!account.primary_email)
    return {
      ok: false,
      error: "Add an account email before using invoice/check billing.",
    };
  const customer = await stripe.customers.create({
    name: loc.display_name ?? undefined,
    email: account.primary_email,
    metadata: { account_id: account.id, location_id: loc.id },
  });
  // Full-service is flat per-location regardless of count; isFirst ignored.
  const ref = locationPriceRef("full_service", true);
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: resolvePriceId(ref.plan, ref.component, interval) }],
    ...(discount.promotionCodeId
      ? { discounts: [{ promotion_code: discount.promotionCodeId }] }
      : {}),
    ...(PLAN_HAS_TRIAL.full_service
      ? { trial_period_days: TRIAL_DAYS }
      : {}),
    collection_method: "send_invoice",
    days_until_due: 30,
    metadata: {
      account_id: account.id,
      location_id: loc.id,
      plan: "full_service",
      interval,
      kind: "location",
    },
  });

  // Stripe creates the first invoice as a draft and only auto-finalizes
  // ~1h later. Finalize now so it's a real, sendable invoice immediately
  // (status "open", PDF/hosted URL) that staff deliver to the client and
  // mark paid out of band when the check clears.
  const invId =
    typeof sub.latest_invoice === "string"
      ? sub.latest_invoice
      : sub.latest_invoice?.id;
  if (invId) await stripe.invoices.finalizeInvoice(invId);

  await service.from("location_subscriptions").upsert(
    {
      location_id: loc.id,
      account_id: account.id,
      plan: "full_service",
      collection_method: "invoice",
      stripe_customer_id: customer.id,
      stripe_subscription_id: sub.id,
      billing_interval: interval,
      subscription_status: sub.status,
      current_period_end: sub.items.data[0]?.current_period_end
        ? new Date(
            sub.items.data[0].current_period_end * 1000,
          ).toISOString()
        : null,
    },
    { onConflict: "location_id" },
  );
  revalidatePath("/app/billing");
  return { ok: true };
}

/** Stripe Customer Portal for a single location's own customer. */
export async function createLocationPortalSession(
  fd: FormData,
): Promise<ActionResult> {
  if (!isStripeConfigured())
    return { ok: false, error: "Billing is not configured." };
  const account = await currentAccount();
  if (!account) return { ok: false, error: "No account." };
  const locationId = String(fd.get("location_id") ?? "");
  const { data: sub } = await createServiceClient()
    .from("location_subscriptions")
    .select("stripe_customer_id, account_id")
    .eq("location_id", locationId)
    .maybeSingle();
  if (!sub || sub.account_id !== account.id || !sub.stripe_customer_id)
    return { ok: false, error: "No billing for this location yet." };
  const session = await getStripe().billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${await appUrl()}/app/billing?status=portal`,
  });
  return { ok: true, url: session.url };
}
