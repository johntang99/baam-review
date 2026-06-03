import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface OnboardingStatus {
  hasLocation: boolean;
  hasBilling: boolean;
  hasActivatedRequest: boolean;
  complete: boolean;
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
        "stripe_customer_id, subscription_status, onboarding_request_activated_at",
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

  return {
    hasLocation,
    hasBilling,
    hasActivatedRequest,
    complete: hasLocation && hasBilling && hasActivatedRequest,
  };
}
