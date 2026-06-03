import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type ReviewPlan = "self_service" | "full_service" | null;

export interface OnboardingStatus {
  plan: ReviewPlan;
  hasLocation: boolean;
  hasBilling: boolean;
  hasActivatedRequest: boolean;
  /** All three explicit steps are checked off. */
  complete: boolean;
  /** Any review request has been sent under this account — a stronger
   *  signal than the bar flags that the user is past the Getting-Started
   *  phase. Triggers the bar to auto-hide for established users who never
   *  bothered to click the "Start Review Request" step explicitly. */
  hasAnyRequest: boolean;
  /** Convenience: should the bar be shown at all? False when the user is
   *  done with the journey (complete) OR has already started using the
   *  product (hasAnyRequest). */
  showBar: boolean;
}

/**
 * Compute the 3 onboarding flags for the "Getting started" progress bar.
 * Used by /app, /app/billing and /app/locations/connect/picker so the bar
 * reflects the same state on every page the user might land on during
 * the journey.
 *
 * "Has billing" covers both Full Service (account-level subscription set
 * by the trial signup) and Self Service (per-location subscriptions
 * created from /app/billing) — either path counts as Step 2 done.
 */
export async function getOnboardingStatus(
  supabase: SupabaseClient<Database>,
  accountId: string,
): Promise<OnboardingStatus> {
  const [{ count: locCount }, { data: account }] = await Promise.all([
    supabase
      .from("locations")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId),
    supabase
      .from("accounts")
      .select(
        "review_plan, stripe_customer_id, subscription_status, onboarding_request_activated_at",
      )
      .eq("id", accountId)
      .maybeSingle(),
  ]);

  const hasLocation = (locCount ?? 0) > 0;

  const accountSubLive =
    !!account?.stripe_customer_id &&
    (account?.subscription_status === "trialing" ||
      account?.subscription_status === "active" ||
      account?.subscription_status === "past_due");
  let hasBilling = accountSubLive;
  if (!hasBilling) {
    const { data: anyLocSub } = await supabase
      .from("location_subscriptions")
      .select("id")
      .eq("account_id", accountId)
      .in("subscription_status", ["trialing", "active", "past_due"])
      .limit(1)
      .maybeSingle();
    hasBilling = !!anyLocSub;
  }

  const hasActivatedRequest = !!account?.onboarding_request_activated_at;

  // "Established" signal: this account has sent at least one review
  // request, so they're past Getting-Started even if they never clicked
  // the explicit Step 3 button. Head-only count is free.
  const { count: requestCount } = await supabase
    .from("review_requests")
    .select("id", { count: "exact", head: true })
    .in(
      "location_id",
      // Filter by this account's locations. Sub-select keeps the query
      // tight without pulling location rows we already have above.
      (
        await supabase
          .from("locations")
          .select("id")
          .eq("account_id", accountId)
      ).data?.map((l) => l.id) ?? ["00000000-0000-0000-0000-000000000000"],
    );
  const hasAnyRequest = (requestCount ?? 0) > 0;

  const complete = hasLocation && hasBilling && hasActivatedRequest;

  return {
    plan: (account?.review_plan as ReviewPlan) ?? null,
    hasLocation,
    hasBilling,
    hasActivatedRequest,
    complete,
    hasAnyRequest,
    showBar: !complete && !hasAnyRequest,
  };
}
