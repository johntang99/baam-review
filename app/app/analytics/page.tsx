import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, BarChart3, DollarSign, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedLocationId } from "@/lib/selected-location";
import {
  getInternalContext,
  getVisibleLocationIds,
} from "@/lib/auth/staff";
import { PageHeader } from "@/components/admin/page-header";
import { Breakdown } from "@/components/admin/breakdown";
import { Funnel } from "@/components/admin/funnel";
import {
  buildFunnel,
  countBy,
  pctFormat,
  relativeTime,
  PLATFORM_LABEL,
  LANGUAGE_LABEL,
  sourceLabel,
} from "@/lib/analytics/aggregate";
import { RevenueInputs } from "./revenue-inputs";

export const metadata = { title: "Analytics & Review Revenue — BAAM Review" };
export const dynamic = "force-dynamic";

type Tab = "activity" | "revenue";

const WINDOW_DAYS = 30;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabRaw } = await searchParams;
  const tab: Tab = tabRaw === "revenue" ? "revenue" : "activity";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/analytics");
  const sinceIso = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const selectedLocationId = await getSelectedLocationId();

  const internal = await getInternalContext(supabase, user.id);
  const visibleIds = await getVisibleLocationIds(supabase, internal);
  const idFilter =
    visibleIds === null
      ? null
      : visibleIds.length > 0
        ? visibleIds
        : ["00000000-0000-0000-0000-000000000000"];

  let locationsQuery = supabase
    .from("locations")
    .select("id, display_name, slug, account_id");
  if (idFilter) locationsQuery = locationsQuery.in("id", idFilter);
  const { data: locations } = await locationsQuery;
  const locById = new Map((locations ?? []).map((l) => [l.id, l]));

  // ----- Activity tab data (90d funnel uses 30d for parity with prototype) -----
  let requestsQuery = supabase
    .from("review_requests")
    .select(
      "id, recipient_name, language, channel, sent_at, delivered_at, clicked_at, completed_platform, completed_at, created_at, location_id, flagged_at, flag_reason",
    )
    .gte("created_at", sinceIso);
  if (idFilter) requestsQuery = requestsQuery.in("location_id", idFilter);
  if (selectedLocationId)
    requestsQuery = requestsQuery.eq("location_id", selectedLocationId);
  const { data: requests } = await requestsQuery;

  let pageViewsQuery = supabase
    .from("landing_events")
    .select("metadata, location_id, occurred_at")
    .eq("event_type", "page_view")
    .gte("occurred_at", sinceIso);
  if (idFilter) pageViewsQuery = pageViewsQuery.in("location_id", idFilter);
  if (selectedLocationId)
    pageViewsQuery = pageViewsQuery.eq("location_id", selectedLocationId);
  const { data: pageViews } = await pageViewsQuery;

  // Referrals — top advocates aggregate + raw event counts for the funnel.
  let referralsQuery = supabase
    .from("referrals")
    .select(
      "id, event_type, advocate_request_id, location_id, created_at",
    )
    .gte("created_at", sinceIso);
  if (idFilter) referralsQuery = referralsQuery.in("location_id", idFilter);
  if (selectedLocationId)
    referralsQuery = referralsQuery.eq("location_id", selectedLocationId);
  const { data: referrals } = await referralsQuery;

  // ----- Revenue tab data (the location whose inputs we'll edit) -----
  let revenueLocation = selectedLocationId
    ? (locations ?? []).find((l) => l.id === selectedLocationId) ?? null
    : null;
  if (!revenueLocation && locations && locations.length > 0) {
    revenueLocation = locations[0];
  }
  const revenueLocationFull = revenueLocation
    ? (
        await supabase
          .from("locations")
          .select(
            "id, display_name, avg_customer_value_cents, ltv_per_customer_cents, referral_close_rate, review_attribution_share",
          )
          .eq("id", revenueLocation.id)
          .maybeSingle()
      ).data
    : null;

  // New 4★+ reviews in this period (for the modeled review bucket).
  let newReviewsQuery = supabase
    .from("google_reviews")
    .select("id, rating, location_id, review_create_time")
    .gte("review_create_time", sinceIso)
    .gte("rating", 4);
  if (revenueLocation)
    newReviewsQuery = newReviewsQuery.eq("location_id", revenueLocation.id);
  const { data: newReviewRows } = await newReviewsQuery;

  // Tracked booking clicks for the referral bucket.
  let bookClicksQuery = supabase
    .from("referrals")
    .select("id, location_id, created_at")
    .eq("event_type", "offer_book_click")
    .gte("created_at", sinceIso);
  if (revenueLocation)
    bookClicksQuery = bookClicksQuery.eq("location_id", revenueLocation.id);
  const { data: bookClickRows } = await bookClicksQuery;

  // ----- Render -----
  return (
    <main className="px-10 py-10 space-y-6">
      <PageHeader
        eyebrow="Analytics & Review Revenue"
        title={`Last ${WINDOW_DAYS} days`}
        description="Activity, funnels, and an estimate of the dollar value those flows produced."
      />

      <nav className="flex gap-1 border-b border-border-base">
        <TabLink
          href="/app/analytics?tab=activity"
          active={tab === "activity"}
          icon={BarChart3}
          label="Activity & Funnel"
        />
        <TabLink
          href="/app/analytics?tab=revenue"
          active={tab === "revenue"}
          icon={DollarSign}
          label="Estimated Revenue"
        />
      </nav>

      {tab === "activity" ? (
        <ActivityTab
          requests={requests ?? []}
          pageViews={pageViews ?? []}
          referrals={referrals ?? []}
          locById={locById}
        />
      ) : (
        <RevenueTab
          revenueLocation={revenueLocationFull}
          newReviewCount={(newReviewRows ?? []).length}
          bookClickCount={(bookClickRows ?? []).length}
        />
      )}
    </main>
  );
}

// ============ ACTIVITY TAB ============

interface RequestRow {
  id: string;
  recipient_name: string;
  language: string;
  channel: string;
  sent_at: string | null;
  delivered_at: string | null;
  clicked_at: string | null;
  completed_platform: string | null;
  completed_at: string | null;
  created_at: string;
  location_id: string;
  flagged_at: string | null;
  flag_reason: string | null;
}

interface PageViewRow {
  metadata: unknown;
  location_id: string;
  occurred_at: string;
}

interface ReferralRow {
  id: string;
  event_type: string;
  advocate_request_id: string | null;
  location_id: string;
  created_at: string;
}

function ActivityTab({
  requests,
  pageViews,
  referrals,
  locById,
}: {
  requests: RequestRow[];
  pageViews: PageViewRow[];
  referrals: ReferralRow[];
  locById: Map<string, { display_name: string }>;
}) {
  const sent = requests.filter((r) => r.sent_at).length;
  const delivered = requests.filter((r) => r.delivered_at).length;
  const clicked = requests.filter((r) => r.clicked_at).length;
  const completed = requests.filter((r) => r.completed_at).length;

  const funnel = buildFunnel([
    { key: "sent", label: "Sent", count: sent },
    { key: "delivered", label: "Delivered", count: delivered },
    { key: "clicked", label: "Clicked", count: clicked },
    { key: "completed", label: "Completed", count: completed },
  ]);

  // Referrals sub-funnel
  const advocateIds = new Set(
    referrals
      .filter((e) => e.event_type === "review_submitted")
      .map((e) => e.advocate_request_id)
      .filter(Boolean),
  );
  const shareViews = referrals.filter((e) => e.event_type === "share_view").length;
  const bookClicks = referrals.filter((e) => e.event_type === "offer_book_click").length;
  const reviewsViaReferral = referrals.filter((e) => e.event_type === "review_submitted").length;

  // Top referrers — count clicks per advocate
  const clicksByAdvocate = new Map<string, number>();
  for (const e of referrals) {
    if (e.event_type !== "offer_book_click" || !e.advocate_request_id) continue;
    clicksByAdvocate.set(
      e.advocate_request_id,
      (clicksByAdvocate.get(e.advocate_request_id) ?? 0) + 1,
    );
  }
  const topReferrers = [...clicksByAdvocate.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const byChannel = countBy(requests, (r) => r.channel, (k) => k.toUpperCase());
  const byPlatform = countBy(
    requests.filter((r) => r.completed_platform),
    (r) => r.completed_platform ?? null,
    (k) => PLATFORM_LABEL[k] ?? k,
  );
  const byLanguage = countBy(
    requests,
    (r) => r.language,
    (k) => LANGUAGE_LABEL[k] ?? k,
  );
  const byLocation = countBy(
    requests,
    (r) => r.location_id,
    (id) => locById.get(id)?.display_name ?? "—",
  );

  const bySource = countBy(
    pageViews,
    (e) => {
      const m = (e.metadata ?? {}) as { source?: string };
      return m.source ?? "direct";
    },
    (k) => sourceLabel(k === "direct" ? null : k),
  );

  const flagged = requests.filter((r) => r.flagged_at);

  // Recent activity stream — newest first across reviews + flagged + completions
  const recent: { kind: string; when: string; text: string }[] = [];
  for (const r of requests.filter((r) => r.completed_at).slice(0, 5)) {
    recent.push({
      kind: r.completed_platform === "private_feedback" ? "sage" : "green",
      when: r.completed_at!,
      text: `Click-through · ${r.recipient_name} → ${PLATFORM_LABEL[r.completed_platform ?? ""] ?? r.completed_platform ?? "platform"}`,
    });
  }
  for (const e of referrals
    .filter((e) => e.event_type === "offer_book_click")
    .slice(0, 5)) {
    recent.push({
      kind: "gold",
      when: e.created_at,
      text: `Friend clicked Book from a referral`,
    });
  }
  recent.sort((a, b) => (a.when > b.when ? -1 : 1));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border-base bg-paper p-6 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[18px] text-ink">From request sent to revenue</h2>
          <p className="text-[12px] text-text-muted">
            Overall completion {sent === 0 ? "—" : pctFormat(completed / sent)}
          </p>
        </div>
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-text-muted font-medium">
          Collection funnel
        </p>
        <Funnel steps={funnel} topCount={sent} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Referrals card */}
        <section className="rounded-2xl border border-border-base bg-paper p-6 space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[18px] text-ink">Referrals</h2>
            <Link
              href="/app/referrals?tab=activity"
              className="text-[12.5px] font-medium text-forest hover:underline"
            >
              Details →
            </Link>
          </div>

          <p className="font-display italic text-[16px] text-text-soft leading-snug">
            <span className="not-italic font-medium text-gold-dark text-[34px] align-[-4px] mr-2">
              {reviewsViaReferral}
            </span>
            new reviews attributable to{" "}
            <b className="not-italic text-ink font-medium">
              reviewer-driven referrals
            </b>{" "}
            this month.
          </p>

          <div className="grid grid-cols-4 gap-2">
            <FunnelTile n={advocateIds.size} label="Reviewers" />
            <FunnelTile n={shareViews} label="Share views" />
            <FunnelTile n={bookClicks} label="Clicked" />
            <FunnelTile n={reviewsViaReferral} label="Reviewed" />
          </div>

          {topReferrers.length > 0 && (
            <>
              <p className="pt-3 border-t border-border-soft text-[11px] uppercase tracking-[0.14em] text-text-muted font-medium">
                Top referrers
              </p>
              <ul className="space-y-0">
                {topReferrers.map(([id, count]) => (
                  <li
                    key={id}
                    className="flex items-center gap-3 py-2.5 border-b border-border-soft last:border-b-0 text-[13px]"
                  >
                    <span className="h-7 w-7 rounded-full bg-sage flex items-center justify-center text-[11px] font-semibold text-cream">
                      {id.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex-1 font-medium text-text truncate">
                      Advocate {id.slice(0, 8)}
                    </span>
                    <span className="text-[12px] text-text-muted">
                      <b className="text-gold-dark font-display text-[14px]">
                        {count}
                      </b>{" "}
                      booking{count === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Recent activity */}
        <section className="rounded-2xl border border-border-base bg-paper p-6 space-y-1">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="font-display text-[18px] text-ink">Recent activity</h2>
            <Link
              href="/app/reviews"
              className="text-[12.5px] font-medium text-forest hover:underline"
            >
              Inbox →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-[13px] text-text-muted italic py-2">
              Nothing yet — events will show up here as customers interact.
            </p>
          ) : (
            <ul>
              {recent.slice(0, 6).map((it, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[8px_1fr_auto] gap-3 items-center py-2.5 border-b border-border-soft last:border-b-0 text-[13px]"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      it.kind === "green"
                        ? "bg-forest"
                        : it.kind === "gold"
                          ? "bg-gold"
                          : "bg-sage"
                    }`}
                  />
                  <span className="text-text">{it.text}</span>
                  <span className="text-[11.5px] text-text-muted whitespace-nowrap font-mono">
                    {relativeTime(it.when)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Breakdowns — preserved from prior analytics page */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Breakdown title="By location" rows={byLocation} emptyMessage="No requests yet." />
        <Breakdown title="By language" rows={byLanguage} emptyMessage="No requests yet." />
        <Breakdown title="By channel" rows={byChannel} emptyMessage="No requests yet." />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Breakdown
          title="Completed reviews by platform"
          rows={byPlatform}
          emptyMessage="No completions yet."
        />
        <Breakdown
          title="Public page sources"
          rows={bySource}
          emptyMessage="No public page visits yet."
        />
      </section>

      {flagged.length > 0 && (
        <section className="rounded-2xl border border-border-base bg-paper p-6 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[18px] text-ink">Flagged requests</h2>
            <p className="text-[12px] text-text-muted">
              Sends that exceeded the velocity threshold. Confirm before continuing.
            </p>
          </div>
          <ul className="divide-y divide-border-soft">
            {flagged.slice(0, 25).map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-warn flex-shrink-0" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[13.5px] text-ink truncate">{r.recipient_name}</p>
                  <p className="text-[11.5px] text-text-muted">
                    {locById.get(r.location_id)?.display_name ?? "—"} ·{" "}
                    {r.flag_reason ?? "flagged"}
                  </p>
                </div>
                <span className="text-[11.5px] text-text-muted whitespace-nowrap">
                  {relativeTime(r.flagged_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex justify-end">
        <Link
          href="/app/analytics/advocates"
          className="inline-flex items-center gap-2 rounded-full border border-border-base bg-paper px-4 py-2 text-[13px] font-medium text-text hover:bg-hover"
        >
          <Trophy className="h-3.5 w-3.5 text-gold" />
          Best advocates leaderboard
        </Link>
      </div>
    </div>
  );
}

function FunnelTile({ n, label }: { n: number; label: string }) {
  return (
    <div className="bg-cream-deep rounded-xl py-3.5 px-3 text-center relative">
      <div className="font-display text-[26px] font-medium text-ink leading-none">
        {n}
      </div>
      <div className="mt-1 text-[10.5px] uppercase tracking-[0.1em] text-text-muted font-medium">
        {label}
      </div>
    </div>
  );
}

// ============ REVENUE TAB ============

function RevenueTab({
  revenueLocation,
  newReviewCount,
  bookClickCount,
}: {
  revenueLocation:
    | {
        id: string;
        display_name: string;
        avg_customer_value_cents: number | null;
        ltv_per_customer_cents: number | null;
        referral_close_rate: number;
        review_attribution_share: number;
      }
    | null;
  newReviewCount: number;
  bookClickCount: number;
}) {
  if (!revenueLocation) {
    return (
      <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-10 text-center text-[14px] text-text-soft">
        <p>
          Connect a Google Business Profile first so we have a location to
          calculate revenue for.
        </p>
        <Link
          href="/app/locations"
          className="mt-4 inline-block text-[13.5px] font-medium text-forest hover:underline"
        >
          Go to Locations →
        </Link>
      </div>
    );
  }

  const initialTicket = (revenueLocation.avg_customer_value_cents ?? 15000) / 100;
  const initialLtv = (revenueLocation.ltv_per_customer_cents ?? 98000) / 100;
  const initialClose = Math.round(
    (revenueLocation.referral_close_rate ?? 0.5) * 100,
  );
  const initialAttr = Math.round(
    (revenueLocation.review_attribution_share ?? 0.5) * 100,
  );

  return (
    <div className="space-y-6">
      <p className="text-[13px] text-text-soft">
        Calculating for <b className="font-medium text-ink">{revenueLocation.display_name}</b>.
        Switch via the sidebar dropdown to focus on a different location.
      </p>

      <RevenueInputs
        locationId={revenueLocation.id}
        initial={{
          ticket: initialTicket,
          ltv: initialLtv,
          closeRatePct: initialClose,
          attributionPct: initialAttr,
        }}
        data={{
          bookClicks: bookClickCount,
          newReviewsAtLeast4Star: newReviewCount,
          profileViewLift: null,
        }}
      />
    </div>
  );
}

// ============ TAB LINK ============

function TabLink({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`relative inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors ${
        active ? "text-ink" : "text-text-soft hover:text-ink"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {active && (
        <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-forest" />
      )}
    </Link>
  );
}
