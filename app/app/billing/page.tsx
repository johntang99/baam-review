import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getInternalContext,
  getVisibleLocationIds,
} from "@/lib/auth/staff";
import { PageHeader } from "@/components/admin/page-header";
import { Section } from "@/components/ui/section";
import type { ReviewPlan } from "@/lib/billing/plans";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import {
  reconcileCheckoutSession,
  reconcileAccountSubscriptions,
} from "@/lib/billing/sync";
import { PlanChooser, LocationActions } from "./billing-client";

export const metadata = { title: "Billing — BAAM Review" };

// This page MUST execute its Stripe reconcile + Supabase reads on every
// request. Force-dynamic prevents Next.js 16's auto-static / RSC payload
// caching from serving a stale render after portal-driven changes
// (cancel, card update, plan switch) that happen outside our app.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtDate(s: string | null) {
  return s
    ? new Date(s).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; session_id?: string }>;
}) {
  const { status, session_id } = await searchParams;

  // Reconcile straight from Stripe on the success redirect so the UI is
  // correct immediately even if the webhook is delayed/missed.
  if (session_id && isStripeConfigured()) {
    await reconcileCheckoutSession(getStripe(), session_id);
  }

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
  if (!profile?.account_id) redirect("/app");

  // Always re-sync all of the account's Stripe subscriptions on load.
  // Stripe is the source of truth; the webhook can be delayed/undelivered
  // and portal changes (cancel, card swap, plan change) happen out of
  // band — so the billing page self-heals every visit.
  if (isStripeConfigured()) {
    await reconcileAccountSubscriptions(getStripe(), profile.account_id);
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("review_plan")
    .eq("id", profile.account_id)
    .maybeSingle();

  // Role-based visibility: admin sees every client in the ops tenant;
  // sales sees clients they connected; account_manager sees clients
  // assigned to them; customer logins fall through (RLS scopes by
  // account_id naturally).
  const internal = await getInternalContext(supabase, user.id);
  const visibleIds = await getVisibleLocationIds(supabase, internal);

  let locationsQuery = supabase
    .from("locations")
    .select("id, display_name")
    .eq("account_id", profile.account_id)
    .order("display_name");
  if (visibleIds !== null) {
    locationsQuery = locationsQuery.in(
      "id",
      visibleIds.length > 0
        ? visibleIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  }
  const { data: locations } = await locationsQuery;

  let subsQuery = supabase
    .from("location_subscriptions")
    .select(
      "location_id, plan, collection_method, subscription_status, billing_interval, current_period_end, cancel_at_period_end",
    )
    .eq("account_id", profile.account_id);
  if (visibleIds !== null) {
    subsQuery = subsQuery.in(
      "location_id",
      visibleIds.length > 0
        ? visibleIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  }
  const { data: locSubs } = await subsQuery;
  const subByLoc = new Map(
    (locSubs ?? []).map((s) => [s.location_id, s]),
  );

  const plan = (account?.review_plan as ReviewPlan | null) ?? null;

  return (
    <main className="px-10 py-10">
      <div className="max-w-3xl space-y-2">
        <PageHeader
          eyebrow="Billing"
          title="Plan & billing"
          description="Manage your BAAM Review subscription."
        />

        {status === "success" && (
          <div className="mt-4 rounded-lg border border-forest/30 bg-forest/5 px-4 py-3 text-[13.5px] text-forest">
            Done — it can take a few seconds to reflect; refresh if needed.
          </div>
        )}
        {status === "cancelled" && (
          <div className="mt-4 rounded-lg border border-border-base bg-cream px-4 py-3 text-[13.5px] text-text-soft">
            Checkout cancelled — no charge was made.
          </div>
        )}

        <div className="space-y-5 pt-6">
          {plan === null && (
            <Section
              title="Choose how you'll use BAAM Review"
              description="Self-service for your own business, or Full-service to manage clients."
            >
              <PlanChooser />
            </Section>
          )}

          {(plan === "self_service" || plan === "full_service") && (
            <Section
              title={
                plan === "full_service" ? "Client businesses" : "Locations"
              }
              description={
                plan === "full_service"
                  ? "Each business is billed separately (its own card or pay-by-check)."
                  : "$99/mo per location. Each location is its own subscription with its own card."
              }
            >
              {(locations ?? []).length === 0 ? (
                <p className="text-[13px] text-text-muted">
                  No locations yet. Add one under Locations, then set up its
                  billing here.
                </p>
              ) : (
                <ul className="divide-y divide-border-soft">
                  {(locations ?? []).map((l) => {
                    const s = subByLoc.get(l.id);
                    return (
                      <li
                        key={l.id}
                        id={`location-${l.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 py-4 target:bg-gold/[0.08] target:rounded-lg target:px-3"
                      >
                        <div>
                          <div className="text-[14px] text-ink">
                            {l.display_name}
                          </div>
                          <div
                            className={`text-[12px] ${
                              s?.cancel_at_period_end
                                ? "text-alert"
                                : "text-text-soft"
                            }`}
                          >
                            {s
                              ? `${s.subscription_status ?? "—"}${
                                  s.cancel_at_period_end ? " · canceling" : ""
                                } · ${
                                  s.billing_interval === "year"
                                    ? "annual"
                                    : "monthly"
                                } · ${
                                  s.collection_method === "invoice"
                                    ? "invoice (check)"
                                    : "card"
                                } · ${
                                  s.cancel_at_period_end ? "ends" : "next"
                                } ${fmtDate(s.current_period_end ?? null)}`
                              : "No billing set up"}
                          </div>
                        </div>
                        <LocationActions
                          locationId={l.id}
                          accountPlan={plan}
                          hasSub={
                            Boolean(s) &&
                            s?.subscription_status !== "canceled"
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          )}
        </div>
      </div>
    </main>
  );
}
