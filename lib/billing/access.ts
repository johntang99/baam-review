import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Whether a location may collect reviews (send requests, public review page,
 * widget). A location is gated until its billing is set up:
 *
 *  - It must have a location_subscriptions row that is trialing/active.
 *  - For self_service accounts the account base must ALSO be trialing/active
 *    (the account-level platform fee). full_service has no account base, so
 *    only the location's own subscription matters.
 *  - No account plan chosen → blocked.
 *
 * Reads via the service client so it works on the public, unauthenticated
 * review page and widget too.
 */

export type BillingGateReason =
  | "ok"
  | "no_plan"
  | "location_unbilled"
  | "location_inactive";

export interface LocationBillingState {
  allowed: boolean;
  reason: BillingGateReason;
}

// Statuses that keep service ON. past_due is included to give Stripe's
// Smart Retries (~2 weeks of automatic card retries / dunning) time to
// recover the payment before cutting the customer off. Once Stripe gives
// up the sub becomes canceled / incomplete_expired → blocked.
const ACTIVE = new Set(["trialing", "active", "past_due"]);

export async function getLocationBillingState(
  locationId: string,
): Promise<LocationBillingState> {
  const svc = createServiceClient();

  const { data: loc } = await svc
    .from("locations")
    .select("account_id")
    .eq("id", locationId)
    .maybeSingle();
  if (!loc) return { allowed: false, reason: "location_unbilled" };

  const { data: account } = await svc
    .from("accounts")
    .select("review_plan")
    .eq("id", loc.account_id)
    .maybeSingle();
  if (!account?.review_plan)
    return { allowed: false, reason: "no_plan" };

  // Truly independent: a location is gated only on its OWN subscription.
  // The Self-service account base ($89/mo) is the owner's own business
  // sub, not a platform fee — canceling it doesn't disable other
  // locations on the account. Same rule applies to Full-service.

  const { data: sub } = await svc
    .from("location_subscriptions")
    .select("subscription_status")
    .eq("location_id", locationId)
    .maybeSingle();
  if (!sub) return { allowed: false, reason: "location_unbilled" };
  if (!ACTIVE.has(sub.subscription_status ?? ""))
    return { allowed: false, reason: "location_inactive" };

  return { allowed: true, reason: "ok" };
}

export interface LocationBillingSummary {
  allowed: boolean;
  accountPlan: "self_service" | "full_service" | null;
  locStatus: string | null;
  locMethod: "card" | "invoice" | null;
  canceling: boolean;
  /** When this location's subscription was first created (Stripe sync). */
  contractStart: string | null;
  /** Period end — interpret as "next charge date" if active, or "ends on"
   * if canceling/canceled. */
  contractEnd: string | null;
}

/**
 * Batch version for lists (Locations page, Send form). Three queries total
 * regardless of how many locations, with the same gate rule as
 * getLocationBillingState.
 */
export async function getLocationBillingMap(
  locationIds: string[],
): Promise<Map<string, LocationBillingSummary>> {
  const out = new Map<string, LocationBillingSummary>();
  if (locationIds.length === 0) return out;
  const svc = createServiceClient();

  const { data: locs } = await svc
    .from("locations")
    .select("id, account_id")
    .in("id", locationIds);
  const accountIds = [
    ...new Set((locs ?? []).map((l) => l.account_id).filter(Boolean)),
  ];

  const { data: accounts } = await svc
    .from("accounts")
    .select("id, review_plan")
    .in("id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"]);
  const acctById = new Map((accounts ?? []).map((a) => [a.id, a]));

  const { data: subs } = await svc
    .from("location_subscriptions")
    .select(
      "location_id, subscription_status, collection_method, cancel_at_period_end, created_at, current_period_end",
    )
    .in("location_id", locationIds);
  const subByLoc = new Map((subs ?? []).map((s) => [s.location_id, s]));

  for (const l of locs ?? []) {
    const acct = acctById.get(l.account_id);
    const sub = subByLoc.get(l.id);
    const plan =
      acct?.review_plan === "self_service" ||
      acct?.review_plan === "full_service"
        ? acct.review_plan
        : null;
    const locStatus = sub?.subscription_status ?? null;
    const locMethod =
      sub?.collection_method === "invoice"
        ? "invoice"
        : sub?.collection_method === "card"
          ? "card"
          : null;

    // Each location's gate depends only on its OWN sub status (A1
    // model — truly independent). Account base no longer cross-gates.
    const allowed =
      !!plan && !!locStatus && ACTIVE.has(locStatus);
    out.set(l.id, {
      allowed,
      accountPlan: plan,
      locStatus,
      locMethod,
      canceling: sub?.cancel_at_period_end === true,
      contractStart: sub?.created_at ?? null,
      contractEnd: sub?.current_period_end ?? null,
    });
  }
  return out;
}
