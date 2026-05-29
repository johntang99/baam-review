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
import {
  PlanChooser,
  LocationActions,
  StartFullServiceTrialButton,
} from "./billing-client";

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
    .select(
      "review_plan, stripe_customer_id, subscription_status, current_period_end",
    )
    .eq("id", profile.account_id)
    .maybeSingle();

  // Trial state: the customer paid (Stripe customer exists, sub is in a
  // live state) but hasn't had a location connected yet. We show a
  // "waiting on BAAM to connect GBP" card instead of the start-trial
  // button in this window — otherwise the page invites them to pay again.
  const trialStarted =
    !!account?.stripe_customer_id &&
    (account?.subscription_status === "trialing" ||
      account?.subscription_status === "active" ||
      account?.subscription_status === "past_due");

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
                plan === "full_service" ? (
                  trialStarted ? (
                    <div className="rounded-2xl border border-success/40 bg-success-soft/30 p-5 max-w-2xl space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success/15 text-success">
                          ✓
                        </span>
                        <p className="text-[14.5px] font-semibold text-ink">
                          Trial active — BAAM is connecting your Google Business Profile
                        </p>
                      </div>
                      <p className="text-[13px] text-text-soft leading-relaxed pl-9">
                        Your card is saved.
                        {account?.subscription_status === "trialing"
                          ? " You won't be charged until the trial ends."
                          : ""}{" "}
                        Our team has received your payment and will reach out
                        within 1 business day to connect your GBP. Once
                        connected, your location will appear here.
                      </p>
                      <p className="pl-9 text-[12px] text-text-muted italic">
                        Questions? Reply to your welcome email or contact
                        support@baamplatform.com.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-w-2xl">
                      <p className="text-[13.5px] text-text-soft leading-relaxed">
                        Full Service includes a 30-day free trial. Your card is
                        saved at checkout but not charged until day 31. After
                        payment, our team will connect your Google Business
                        Profile and start sending review requests for you.
                      </p>
                      <StartFullServiceTrialButton />
                    </div>
                  )
                ) : (
                  <p className="text-[13px] text-text-muted">
                    No locations yet. Add one under Locations, then set up its
                    billing here.
                  </p>
                )
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
