import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, AlertCircle, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isUserBaamInternal } from "@/lib/auth/staff";
import {
  getValidAccessToken,
  listGoogleAccounts,
  listGoogleLocations,
  type GoogleLocation,
} from "@/lib/google/business-profile";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { classifyByGoogleCategory } from "@/lib/review/google-category-mapping";
import { CATEGORY_LABELS } from "@/lib/review/industry-presets";
import { getLocationBillingMap } from "@/lib/billing/access";
import { createLocationFromGoogle } from "./actions";

export const metadata = {
  title: "Pick a location — BAAM Review",
};

export const dynamic = "force-dynamic";

export default async function PickerPage({
  searchParams,
}: {
  searchParams: Promise<{ customer_record?: string }>;
}) {
  const { customer_record: customerRecordIdParam } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/locations");

  const { data: profile } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.account_id) redirect("/app/locations?error=no_account");

  // If the picker was opened from the Onboarding queue, this row tells us
  // which paid-but-unconnected customer the next location should be tied to.
  // Set in /app/onboarding when staff clicks "Connect their GBP →".
  //
  // Gate: a customer_record carries someone else's paid Stripe subscription.
  // Only internal staff may bind it to a location, otherwise a regular user
  // could steal a paying customer's subscription by crafting the URL.
  if (customerRecordIdParam) {
    const internal = await isUserBaamInternal(supabase, user.id);
    if (!internal) redirect("/app/locations");
  }
  const customerRecord = customerRecordIdParam
    ? (
        await supabase
          .from("customer_records")
          .select("id, business_name, business_address, email, onboarding_status")
          .eq("id", customerRecordIdParam)
          .maybeSingle()
      ).data
    : null;

  // Existing locations so we can mark already-added places AND surface a
  // "Set up billing" CTA on rows that have no active subscription yet.
  const { data: existing } = await supabase
    .from("locations")
    .select("id, google_place_id")
    .eq("account_id", profile.account_id);
  const claimedByPlaceId = new Map<string, string>(); // place_id → location_id
  for (const r of existing ?? []) {
    if (r.google_place_id) claimedByPlaceId.set(r.google_place_id, r.id);
  }

  // Look up billing state for each claimed location. Locations with no
  // active subscription get the "Set up billing" button rendered next to
  // their "Already added" badge so customers can pay right from this
  // picker — saves a click vs. having to navigate back to /app/locations.
  const billingMap = await getLocationBillingMap(
    Array.from(claimedByPlaceId.values()),
  );

  let locations: GoogleLocation[] = [];
  let fatal: string | null = null;
  let googleEmail: string | null = null;

  // Pre-check the OAuth token row — if this user has never connected
  // Google (or their token has been deleted), kick them through the
  // OAuth flow now and bring them right back here with the
  // customer_record param preserved. Catches the most common cause of
  // the "Couldn't load locations from Google" empty-state.
  const { data: existingToken } = await supabase
    .from("google_oauth_tokens")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existingToken) {
    const here =
      "/app/locations/connect/picker" +
      (customerRecordIdParam
        ? `?customer_record=${encodeURIComponent(customerRecordIdParam)}`
        : "");
    redirect(`/api/auth/google/start?next=${encodeURIComponent(here)}`);
  }

  try {
    // Tokens are per-user (migration 0032). The picker uses the
    // logged-in user's gmail token, so they only see GBPs that *their*
    // email is a manager of.
    const accessToken = await getValidAccessToken(user.id);

    const { data: tokenRow } = await supabase
      .from("google_oauth_tokens")
      .select("google_email")
      .eq("user_id", user.id)
      .maybeSingle();
    googleEmail = tokenRow?.google_email ?? null;

    const accounts = await listGoogleAccounts(accessToken);
    const collected: GoogleLocation[] = [];
    for (const acct of accounts) {
      const locs = await listGoogleLocations(accessToken, acct.name);
      collected.push(...locs);
    }
    locations = collected;
  } catch (e) {
    console.error("Picker fetch failed", e);
    fatal = e instanceof Error ? e.message : "Unknown error";
  }

  const claimedCount = claimedByPlaceId.size;

  return (
    <main className="px-10 py-10 space-y-8">
      <div>
        <Link
          href="/app/locations"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-text-soft hover:text-text mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to locations
        </Link>
        <PageHeader
          eyebrow="Connect Google"
          title="Pick locations"
          description={
            googleEmail
              ? `Showing locations from ${googleEmail}. Add as many as you'd like — tap "Use this location" on each one.`
              : "Add as many locations as you'd like — tap \"Use this location\" on each one."
          }
        >
          {claimedCount > 0 && (
            <Link href="/app/locations">
              <Button variant="secondary">
                Done — view {claimedCount === 1 ? "location" : `${claimedCount} locations`}
              </Button>
            </Link>
          )}
        </PageHeader>
      </div>

      {customerRecord && (
        <div
          role="status"
          className="flex gap-3 rounded-xl border border-gold/40 bg-gold/[0.06] p-4 text-[13.5px] max-w-3xl"
        >
          <UserCheck className="h-4 w-4 mt-0.5 flex-shrink-0 text-gold-dark" />
          <div className="space-y-0.5">
            <p className="font-semibold text-ink">
              Connecting GBP for paid customer:{" "}
              <span className="text-forest">
                {customerRecord.business_name ?? customerRecord.email}
              </span>
            </p>
            <p className="text-text-soft">
              {customerRecord.business_address ?? customerRecord.email}
              {customerRecord.business_address && ` · ${customerRecord.email}`}
            </p>
            <p className="text-text-muted text-[12px] mt-1">
              The location you pick below will be bound to this customer&apos;s
              Stripe subscription. Pick carefully — undo means opening Stripe.
            </p>
          </div>
        </div>
      )}

      {fatal && (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-alert/30 bg-alert/5 p-4 text-[13.5px] text-alert max-w-3xl"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Couldn&apos;t load locations from Google</p>
            <p className="opacity-80">{fatal}</p>
          </div>
        </div>
      )}

      {!fatal && locations.length === 0 && (
        <EmptyResult />
      )}

      {locations.length > 0 && (
        <ul className="grid gap-3 max-w-3xl">
          {locations.map((loc) => {
            const claimed =
              loc.placeId !== null && claimedByPlaceId.has(loc.placeId);
            return (
              <li
                key={loc.name}
                className="rounded-xl border border-border-base bg-paper p-5 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-display text-[17px] text-ink leading-tight">
                      {loc.title}
                    </p>
                    {loc.primaryCategory && (
                      <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
                        {loc.primaryCategory}
                      </p>
                    )}
                    {loc.primaryCategory && (() => {
                      const cat = classifyByGoogleCategory(loc.primaryCategory);
                      return (
                        <p className="text-[12px] text-text-soft">
                          Will be set as <strong className="text-ink">{CATEGORY_LABELS[cat].en}</strong>
                          <span className="text-text-muted"> · change anytime in location settings</span>
                        </p>
                      );
                    })()}
                    {loc.formattedAddress && (
                      <p className="text-[13.5px] text-text-soft">
                        {loc.formattedAddress}
                      </p>
                    )}
                    {loc.websiteUri && (
                      <a
                        href={loc.websiteUri}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[12.5px] text-forest hover:underline"
                      >
                        {loc.websiteUri.replace(/^https?:\/\//, "")}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {claimed ? (
                      (() => {
                        const locId = loc.placeId
                          ? claimedByPlaceId.get(loc.placeId)
                          : undefined;
                        const billing = locId
                          ? billingMap.get(locId)
                          : undefined;
                        const needsBilling =
                          !!locId && (!billing || !billing.allowed);
                        return (
                          <>
                            <span className="inline-flex items-center rounded-md bg-sage-soft px-2.5 py-1 text-[11.5px] font-medium text-forest-dark">
                              Already added
                            </span>
                            {needsBilling && locId && (
                              <Link
                                href={`/app/billing#location-${locId}`}
                                className="inline-flex items-center rounded-md bg-forest px-2.5 py-1 text-[11.5px] font-medium text-cream hover:bg-forest-dark"
                              >
                                Set up billing →
                              </Link>
                            )}
                          </>
                        );
                      })()
                    ) : !loc.placeId ? (
                      <span className="inline-flex items-center rounded-md bg-warn/10 px-2.5 py-1 text-[11.5px] font-medium text-warn">
                        No place ID
                      </span>
                    ) : (
                      <form action={createLocationFromGoogle}>
                        <input
                          type="hidden"
                          name="place_id"
                          value={loc.placeId}
                        />
                        <input
                          type="hidden"
                          name="title"
                          value={loc.title}
                        />
                        <input
                          type="hidden"
                          name="address"
                          value={loc.formattedAddress ?? ""}
                        />
                        <input
                          type="hidden"
                          name="website_uri"
                          value={loc.websiteUri ?? ""}
                        />
                        <input
                          type="hidden"
                          name="primary_category"
                          value={loc.primaryCategory ?? ""}
                        />
                        {customerRecord && (
                          <input
                            type="hidden"
                            name="customer_record_id"
                            value={customerRecord.id}
                          />
                        )}
                        <Button type="submit" size="sm">
                          {customerRecord ? "Bind to customer" : "Use this location"}
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function EmptyResult() {
  return (
    <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-10 text-center max-w-2xl">
      <h2 className="font-display text-[20px] text-ink">
        No Google Business Profile locations
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-[14px] text-text-soft leading-relaxed">
        We couldn&apos;t find any verified locations on the Google account you
        connected. You may need to claim or verify your business at{" "}
        <a
          href="https://business.google.com"
          target="_blank"
          rel="noreferrer"
          className="text-forest underline"
        >
          business.google.com
        </a>
        .
      </p>
      <Link href="/app/locations" className="mt-5 inline-block">
        <Button variant="secondary">Back to locations</Button>
      </Link>
    </div>
  );
}
