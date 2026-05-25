import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Code,
  MessageSquareReply,
  Send,
  Sparkles,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedLocationId } from "@/lib/selected-location";
import {
  getInternalContext,
  getVisibleLocationIds,
} from "@/lib/auth/staff";
import {
  buildFunnel,
  pctFormat,
  PLATFORM_LABEL,
  LANGUAGE_LABEL,
  relativeTime,
} from "@/lib/analytics/aggregate";
import { Funnel } from "@/components/admin/funnel";
import { computeRevenue, fmtUSD } from "@/lib/analytics/revenue";
import { getLocationBillingState } from "@/lib/billing/access";
import { BillingRequiredBanner } from "@/components/admin/billing-required-banner";
import type { ReferralConfig } from "@/lib/database.types";

export const metadata = {
  title: "Dashboard — BAAM Review",
};

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, account_id")
    .eq("id", user!.id)
    .maybeSingle();

  const { data: account } = profile?.account_id
    ? await supabase
        .from("accounts")
        .select("name, subscription_tier")
        .eq("id", profile.account_id)
        .maybeSingle()
    : { data: null };

  const sinceIso = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const priorSinceIso = new Date(
    Date.now() - 2 * WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const selectedLocationId = await getSelectedLocationId();

  // Role-based visibility — sales / account_manager only see their own
  // clients on the dashboard. Admin and customer logins fall through.
  const internal = await getInternalContext(supabase, user!.id);
  const visibleIds = await getVisibleLocationIds(supabase, internal);
  const idFilter =
    visibleIds === null
      ? null
      : visibleIds.length > 0
        ? visibleIds
        : ["00000000-0000-0000-0000-000000000000"];

  let locationsQuery = supabase
    .from("locations")
    .select(
      "id, display_name, slug, brand_color, address, avg_customer_value_cents, ltv_per_customer_cents, referral_close_rate, review_attribution_share, referral_config, logo_url",
    );
  if (idFilter) locationsQuery = locationsQuery.in("id", idFilter);
  const { data: locations } = await locationsQuery;
  const locationName = new Map(
    (locations ?? []).map((l) => [l.id, l.display_name]),
  );
  const selectedLocation = selectedLocationId
    ? (locations ?? []).find((l) => l.id === selectedLocationId) ?? null
    : null;

  const billingGate = selectedLocation
    ? await getLocationBillingState(selectedLocation.id)
    : null;

  // Pick the location we'll preview the referral offer / share card for: the
  // selected one, otherwise the first that has a referral_config configured.
  const previewLocation =
    selectedLocation ??
    (locations ?? []).find(
      (l) => l.referral_config && (l.referral_config as ReferralConfig)?.enabled,
    ) ??
    (locations ?? [])[0] ??
    null;

  // Review requests funnel data (this + prior period for delta).
  let requestsQuery = supabase
    .from("review_requests")
    .select(
      "id, recipient_name, language, channel, sent_at, delivered_at, clicked_at, completed_platform, completed_at, created_at, location_id, flagged_at",
    )
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });
  if (idFilter) requestsQuery = requestsQuery.in("location_id", idFilter);
  if (selectedLocationId)
    requestsQuery = requestsQuery.eq("location_id", selectedLocationId);
  const { data: requests } = await requestsQuery;

  let feedbackQuery = supabase
    .from("private_feedback")
    .select(
      "id, message, rating, created_at, language, location_id, read_at",
    )
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });
  if (idFilter) feedbackQuery = feedbackQuery.in("location_id", idFilter);
  if (selectedLocationId)
    feedbackQuery = feedbackQuery.eq("location_id", selectedLocationId);
  const { data: feedback } = await feedbackQuery;

  // Google reviews — all-time (for AI reply queue + share preview + counts).
  let googleReviewsQuery = supabase
    .from("google_reviews")
    .select(
      "id, google_review_id, rating, comment, reviewer_display_name, reviewer_profile_photo_url, review_create_time, reply_comment, location_id",
    )
    .order("review_create_time", { ascending: false })
    .limit(50);
  if (idFilter) googleReviewsQuery = googleReviewsQuery.in("location_id", idFilter);
  if (selectedLocationId)
    googleReviewsQuery = googleReviewsQuery.eq("location_id", selectedLocationId);
  const { data: googleReviews } = await googleReviewsQuery;

  // Referrals — used for pipeline, top advocates, and the revenue calc.
  let referralsQuery = supabase
    .from("referrals")
    .select("id, event_type, advocate_request_id, location_id, created_at")
    .gte("created_at", sinceIso);
  if (idFilter) referralsQuery = referralsQuery.in("location_id", idFilter);
  if (selectedLocationId)
    referralsQuery = referralsQuery.eq("location_id", selectedLocationId);
  const { data: referrals } = await referralsQuery;

  // Prior-period new reviews (for delta on the revenue strip).
  let priorReviewsQuery = supabase
    .from("google_reviews")
    .select("id, rating, location_id, review_create_time")
    .gte("review_create_time", priorSinceIso)
    .lt("review_create_time", sinceIso);
  if (idFilter)
    priorReviewsQuery = priorReviewsQuery.in("location_id", idFilter);
  if (selectedLocationId)
    priorReviewsQuery = priorReviewsQuery.eq("location_id", selectedLocationId);
  const { data: priorReviews } = await priorReviewsQuery;

  // Widget impressions = embed_loads in window. Best proxy for "website widget views".
  let embedQuery = supabase
    .from("embed_loads")
    .select("id, occurred_at, location_id")
    .gte("occurred_at", sinceIso);
  if (idFilter) embedQuery = embedQuery.in("location_id", idFilter);
  if (selectedLocationId)
    embedQuery = embedQuery.eq("location_id", selectedLocationId);
  const { data: embedLoads } = await embedQuery;

  // ----- Derived numbers -----
  const rs = requests ?? [];
  const sent = rs.filter((r) => r.sent_at).length;
  const delivered = rs.filter((r) => r.delivered_at).length;
  const clicked = rs.filter((r) => r.clicked_at).length;
  const completed = rs.filter((r) => r.completed_at).length;

  const funnel = buildFunnel([
    { key: "sent", label: "Sent", count: sent },
    { key: "delivered", label: "Delivered", count: delivered },
    { key: "clicked", label: "Clicked", count: clicked },
    { key: "completed", label: "Completed", count: completed },
  ]);
  const completionRate = sent === 0 ? 0 : completed / sent;

  const gr = googleReviews ?? [];
  const grRecent30 = gr.filter(
    (r) =>
      new Date(r.review_create_time).getTime() >
      Date.now() - WINDOW_DAYS * 86_400_000,
  );
  const grNew = grRecent30.length;
  const grPrior = (priorReviews ?? []).length;
  const grDelta = grNew - grPrior;

  const grAvg30 =
    grNew === 0 ? 0 : grRecent30.reduce((s, r) => s + r.rating, 0) / grNew;
  const grLowUnreplied = gr.filter((r) => r.rating <= 3 && !r.reply_comment);
  const grNeedsReply = gr.filter((r) => !r.reply_comment);
  const aiReplyQueue = grNeedsReply.slice(0, 3);

  // Latest 5-star review with comment — for the "Share a review" preview.
  const shareCandidate =
    gr.find((r) => r.rating === 5 && r.comment && r.comment.trim().length > 0) ??
    null;

  // Referral pipeline counts. Reviewers = distinct advocate_request_id across
  // any event. Shared = share_view, Clicked = offer_book_click, Booked =
  // review_submitted (the deepest funnel signal we currently track).
  const refs = referrals ?? [];
  const refAdvocates = new Set(
    refs.map((r) => r.advocate_request_id).filter(Boolean),
  ).size;
  const refShared = refs.filter((r) => r.event_type === "share_view").length;
  const refClicked = refs.filter(
    (r) => r.event_type === "offer_book_click",
  ).length;
  const refBooked = refs.filter(
    (r) => r.event_type === "review_submitted",
  ).length;

  // Top referrers — distinct advocates ranked by tracked book clicks.
  const clicksByAdvocate = new Map<string, number>();
  for (const e of refs) {
    if (e.event_type !== "offer_book_click" || !e.advocate_request_id) continue;
    clicksByAdvocate.set(
      e.advocate_request_id,
      (clicksByAdvocate.get(e.advocate_request_id) ?? 0) + 1,
    );
  }
  const topReferrers = [...clicksByAdvocate.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Embed loads = widget views (rough). Delta vs prior period needs a query
  // we already skip for cost; show current count without a delta for now.
  const widgetViews = (embedLoads ?? []).length;

  // ----- Revenue estimate (Engine model). Sensible defaults when location
  // hasn't filled out the Analytics inputs yet so the hero stat still moves. -----
  const ticketCents = previewLocation?.avg_customer_value_cents ?? 30000;
  const ltvCents = previewLocation?.ltv_per_customer_cents ?? 98000;
  const closeRate = previewLocation?.referral_close_rate ?? 0.5;
  const attributionShare = previewLocation?.review_attribution_share ?? 0.5;
  const newReviewsAtLeast4Star = grRecent30.filter((r) => r.rating >= 4).length;
  const revenue = computeRevenue(
    { ticketCents, ltvCents, closeRate, attributionShare },
    {
      bookClicks: refClicked,
      newReviewsAtLeast4Star,
      profileViewLift: null,
    },
  );

  // Service-recovery alert combines low-rating Google reviews + unread feedback.
  const unreadFeedback = (feedback ?? []).filter((f) => !f.read_at).length;
  const needsAttention = grLowUnreplied.length + unreadFeedback;

  // Friendly greeting / date string.
  const firstName =
    (profile?.full_name?.split(" ")[0]) ||
    user?.email?.split("@")[0] ||
    "there";
  const todayLong = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const hasData =
    rs.length + (feedback?.length ?? 0) + gr.length + refs.length > 0;

  // Recent activity feed — merges google reviews, referrals, and completed
  // requests into a single chronological list with status pills.
  type ActivityItem = {
    key: string;
    kind: "referral" | "review" | "completed" | "feedback" | "sent";
    name: string;
    meta: string;
    channelLabel: string;
    lang: string | null;
    at: string;
  };
  const activity: ActivityItem[] = [];
  for (const r of refs.filter((r) => r.event_type === "review_submitted")) {
    activity.push({
      key: `ref-${r.id}`,
      kind: "referral",
      name: `Friend of advocate ${r.advocate_request_id?.slice(0, 6) ?? "—"}`,
      meta: "Reviewed via referral · attributed",
      channelLabel: "Referral",
      lang: null,
      at: r.created_at,
    });
  }
  for (const g of gr.slice(0, 8)) {
    activity.push({
      key: `gr-${g.id}`,
      kind: "review",
      name: g.reviewer_display_name ?? "Anonymous",
      meta: `${g.rating}★ on Google${g.reply_comment ? " · replied" : ""}`,
      channelLabel: "Google",
      lang: null,
      at: g.review_create_time,
    });
  }
  for (const f of (feedback ?? []).slice(0, 5)) {
    activity.push({
      key: `pf-${f.id}`,
      kind: "feedback",
      name: "Anonymous",
      meta: `Private feedback · ${f.rating ?? "—"}★`,
      channelLabel: "QR / form",
      lang: f.language,
      at: f.created_at,
    });
  }
  for (const r of rs.filter((r) => r.completed_at).slice(0, 8)) {
    activity.push({
      key: `rq-${r.id}`,
      kind: "completed",
      name: r.recipient_name,
      meta: `Completed${
        r.completed_platform
          ? ` · ${PLATFORM_LABEL[r.completed_platform] ?? r.completed_platform}`
          : ""
      }`,
      channelLabel: r.channel.toUpperCase(),
      lang: r.language,
      at: r.completed_at!,
    });
  }
  for (const r of rs.filter((r) => r.sent_at && !r.completed_at).slice(0, 4)) {
    activity.push({
      key: `rs-${r.id}`,
      kind: "sent",
      name: r.recipient_name,
      meta: "Sent · awaiting click",
      channelLabel: r.channel.toUpperCase(),
      lang: r.language,
      at: r.sent_at!,
    });
  }
  activity.sort((a, b) => (a.at > b.at ? -1 : 1));

  // Referral offer for the preview card. Read from the chosen location's
  // referral_config, with empty-state fallbacks.
  const offer = (previewLocation?.referral_config ?? {}) as ReferralConfig;
  const brandColor = previewLocation?.brand_color ?? "#962D22";

  return (
    <main className="px-10 py-10 space-y-7">
      {selectedLocation && billingGate && !billingGate.allowed && (
        <BillingRequiredBanner locationName={selectedLocation.display_name} />
      )}
      {/* TOP BAR */}
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            {todayLong} · Last {WINDOW_DAYS} days
            {selectedLocation ? ` · ${selectedLocation.display_name}` : ""}
          </p>
          <h1 className="font-display text-[30px] leading-tight text-ink">
            Good {greetingPart()},{" "}
            <em className="italic text-forest font-normal">{firstName}.</em>
          </h1>
          {!selectedLocation && account?.name && (
            <p className="text-[14px] text-text-soft">
              {account.name} ·{" "}
              <span className="capitalize">{account.subscription_tier}</span> plan
            </p>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-lg border border-border-base bg-paper px-3.5 py-2 text-[13px] font-medium text-text">
            <Calendar className="h-3.5 w-3.5 text-text-soft" />
            Last {WINDOW_DAYS} days
          </span>
          <Link
            href="/app/send"
            className="inline-flex items-center gap-1.5 rounded-lg bg-forest text-cream px-3.5 py-2 text-[13.5px] font-medium hover:bg-forest-dark"
          >
            <Send className="h-3.5 w-3.5" />
            Send request
          </Link>
        </div>
      </header>

      {!hasData ? (
        <EmptyDashboard />
      ) : (
        <>
          {/* SERVICE RECOVERY ALERT */}
          {needsAttention > 0 && (
            <ServiceRecoveryAlert
              lowReviews={grLowUnreplied.length}
              unreadFeedback={unreadFeedback}
              firstLocationId={grLowUnreplied[0]?.location_id ?? null}
            />
          )}

          {/* REVENUE STRIP */}
          <section className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1fr]">
            <RevenueHeroStat
              tier={account?.subscription_tier ?? "Growth"}
              total={revenue.periodRevenue}
              delta={revenue.periodRevenue > 0 ? "▲" : "—"}
              priorTotal={null}
            />
            <RevStat
              label="New Google reviews"
              value={grNew.toString()}
              delta={
                grDelta === 0
                  ? null
                  : { dir: grDelta > 0 ? "up" : "down", text: `${grDelta > 0 ? "▲" : "▼"} ${Math.abs(grDelta)}` }
              }
              period={`this ${WINDOW_DAYS}d`}
            />
            <RevStat
              label="Referral book clicks"
              value={refClicked.toString()}
              delta={
                refClicked === 0
                  ? null
                  : { dir: "up", text: `▲ ${refClicked}` }
              }
              period={`this ${WINDOW_DAYS}d`}
            />
            <RevStat
              label="Widget impressions"
              value={widgetViews.toLocaleString()}
              delta={null}
              period={`this ${WINDOW_DAYS}d`}
            />
          </section>

          {/* CONTENT GRID */}
          <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
            {/* LEFT COLUMN */}
            <div className="space-y-5">
              {/* FUNNEL CARD */}
              <Card
                title="From request sent to revenue"
                action={{ label: "Full analytics", href: "/app/analytics" }}
              >
                <p className="text-[10.5px] uppercase tracking-[0.14em] text-text-muted font-medium mb-3">
                  Collection funnel
                </p>
                <Funnel steps={funnel} topCount={sent} />
                <div className="mt-4 pt-4 border-t border-border-soft">
                  <p className="text-[10.5px] uppercase tracking-[0.14em] text-text-muted font-medium mb-3">
                    Revenue attribution
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="w-[80px] text-[13px] text-text font-medium">
                      Est. impact
                    </span>
                    <div className="flex-1 h-7 rounded-md bg-cream-deep relative overflow-hidden">
                      <div
                        className="h-full rounded-md flex items-center px-3 text-[12px] font-medium text-ink"
                        style={{
                          width: revenue.periodRevenue > 0 ? "85%" : "0",
                          background:
                            "linear-gradient(90deg, var(--color-gold) 0%, var(--color-gold-dark, #A88847) 100%)",
                        }}
                      >
                        {revenue.periodRevenue > 0
                          ? fmtUSD(revenue.periodRevenue)
                          : "$0"}
                      </div>
                    </div>
                    <span className="w-16 text-right text-[11.5px] text-text-muted font-mono">
                      est.
                    </span>
                  </div>
                  <p className="mt-3 text-[13px] italic text-text-soft font-serif leading-snug">
                    {completionRate > 0 && (
                      <>
                        Completing at{" "}
                        <strong className="not-italic font-medium text-forest">
                          {pctFormat(completionRate)}
                        </strong>{" "}
                        — industry average is around 10%.{" "}
                      </>
                    )}
                    Revenue model assumes{" "}
                    <strong className="not-italic font-medium text-forest">
                      {fmtUSD(ticketCents / 100)} ticket
                    </strong>{" "}
                    × tracked book clicks × close rate.
                  </p>
                </div>
              </Card>

              {/* AI REPLY QUEUE */}
              <Card
                title="AI Reply queue"
                badge={
                  grNeedsReply.length > 0
                    ? `${grNeedsReply.length} pending`
                    : undefined
                }
                action={{ label: "Review all", href: "/app/reviews" }}
              >
                {aiReplyQueue.length === 0 ? (
                  <p className="text-[13px] text-text-muted italic py-2">
                    Nothing pending — every Google review has a reply.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {aiReplyQueue.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 rounded-xl border border-border-base bg-cream-deep/60 px-3.5 py-3 hover:bg-paper"
                      >
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sage-soft text-forest-dark text-[12px] font-semibold">
                          {initialsFrom(r.reviewer_display_name)}
                        </span>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
                            <span className="truncate">
                              {r.reviewer_display_name ?? "Anonymous"}
                            </span>
                            <span className="text-gold">
                              {"★".repeat(r.rating)}
                            </span>
                            {r.rating <= 3 && (
                              <span className="rounded-full bg-alert/12 text-alert text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5">
                                Low
                              </span>
                            )}
                          </div>
                          {r.comment && (
                            <p className="text-[12px] italic font-serif text-text-soft line-clamp-1">
                              &ldquo;{r.comment.slice(0, 110)}…&rdquo;
                            </p>
                          )}
                        </div>
                        <Link
                          href={`/app/locations/${r.location_id}/reviews`}
                          className="inline-flex items-center gap-1 rounded-md bg-ink text-cream px-2.5 py-1.5 text-[11.5px] font-medium hover:bg-forest-dark whitespace-nowrap"
                        >
                          <Sparkles className="h-3 w-3" />
                          Draft reply
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* SAMPLE SHARE CARD PREVIEW */}
              <Card
                title="Share a review"
                badge={shareCandidate ? "Latest 5★" : undefined}
                action={
                  shareCandidate && previewLocation
                    ? {
                        label: "Open share studio",
                        href: `/app/locations/${previewLocation.id}/reviews/${shareCandidate.id}/share`,
                      }
                    : undefined
                }
              >
                {!shareCandidate || !previewLocation ? (
                  <p className="text-[13px] text-text-muted italic py-2">
                    Once a customer leaves a 5-star review with a comment, it
                    appears here ready to share.
                  </p>
                ) : (
                  <>
                    <p className="text-[12.5px] italic font-serif text-text-soft mb-3 leading-snug">
                      What your audience sees when you share{" "}
                      <strong className="not-italic font-medium text-ink">
                        {shareCandidate.reviewer_display_name ?? "this review"}
                        &apos;s
                      </strong>{" "}
                      review to Facebook, X, LinkedIn, or WhatsApp.
                    </p>
                    <SharePreviewCard
                      review={shareCandidate}
                      location={previewLocation}
                      brandColor={brandColor}
                    />
                  </>
                )}
              </Card>

              {/* RECENT ACTIVITY */}
              <Card
                title="Recent activity"
                action={{ label: "View all", href: "/app/reviews" }}
              >
                {activity.length === 0 ? (
                  <p className="text-[13px] text-text-muted italic py-2">
                    No activity yet in the last {WINDOW_DAYS} days.
                  </p>
                ) : (
                  <ul className="divide-y divide-border-soft">
                    {activity.slice(0, 6).map((it) => (
                      <ActivityRow key={it.key} item={it} locationName={locationName} />
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-5">
              {/* REFERRALS CARD */}
              <Card
                title="Referrals"
                action={{ label: "Details", href: "/app/referrals" }}
              >
                <p className="font-serif italic text-[15.5px] text-text-soft leading-snug mb-4">
                  <span className="not-italic font-medium text-gold-soft text-[34px] align-[-4px] mr-2">
                    {refBooked}
                  </span>
                  new reviews attributable to{" "}
                  <strong className="not-italic font-medium text-ink">
                    reviewer-driven referrals
                  </strong>{" "}
                  this month.
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  <PipelineTile n={refAdvocates} label="Reviewers" />
                  <PipelineTile n={refShared} label="Shared" />
                  <PipelineTile n={refClicked} label="Clicked" />
                  <PipelineTile n={refBooked} label="Reviewed" highlight />
                </div>

                {topReferrers.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-border-soft">
                    <p className="text-[10.5px] uppercase tracking-[0.14em] text-text-muted font-medium mb-2.5">
                      Top referrers this month
                    </p>
                    <ul className="space-y-0">
                      {topReferrers.map(([id, count]) => (
                        <li
                          key={id}
                          className="flex items-center gap-2.5 py-2 border-b border-border-soft last:border-b-0"
                        >
                          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-sage text-cream text-[10px] font-semibold">
                            {id.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="flex-1 text-[13px] font-medium text-text truncate">
                            Advocate {id.slice(0, 8)}
                          </span>
                          <span className="text-[12px] text-text-muted">
                            <strong className="text-gold-dark font-serif text-[14px] font-medium">
                              {count}
                            </strong>{" "}
                            booking{count === 1 ? "" : "s"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>

              {/* SAMPLE REFERRAL OFFER PREVIEW */}
              <Card
                title="Your referral offer"
                badge={offer?.enabled ? "LIVE" : "OFF"}
                action={{ label: "Edit offer", href: "/app/referrals" }}
              >
                <p className="text-[12.5px] italic font-serif text-text-soft mb-3 leading-snug">
                  What a friend sees on the{" "}
                  <strong className="not-italic font-medium text-ink">
                    landing page
                  </strong>{" "}
                  after a reviewer shares your recommendation card.
                </p>
                <OfferPreviewCard offer={offer} brandColor={brandColor} />
              </Card>

              {/* BEST ADVOCATES PREVIEW */}
              <Card
                title="Best advocates"
                badge={topReferrers.length > 0 ? "Top 5" : undefined}
                action={{
                  label: "All advocates",
                  href: "/app/analytics/advocates",
                }}
              >
                {topReferrers.length === 0 ? (
                  <p className="text-[13px] text-text-muted italic py-2">
                    No advocates yet — once customers start sharing referral
                    cards, the most active ones appear here.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {topReferrers.map(([id, count], idx) => (
                      <li
                        key={id}
                        className="flex items-center gap-3"
                      >
                        <span
                          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                            idx === 0
                              ? "bg-gold text-ink"
                              : "bg-sage text-cream"
                          }`}
                        >
                          {idx === 0 ? <Trophy className="h-4 w-4" /> : id.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-[13.5px] font-medium text-ink truncate">
                            Advocate {id.slice(0, 8)}
                          </p>
                          <p className="text-[11.5px] text-text-muted">
                            Score {Math.min(99, 60 + count * 12)} ·{" "}
                            <span className="text-gold-dark">
                              {count} ref{count === 1 ? "" : "s"}
                            </span>
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

// ============================================================
// Components
// ============================================================

function Card({
  title,
  badge,
  action,
  children,
}: {
  title: string;
  badge?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-base bg-paper p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3 pb-1">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[17px] text-ink">{title}</h2>
          {badge && (
            <span className="rounded-full bg-gold/20 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold-dark px-2 py-0.5">
              {badge}
            </span>
          )}
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-forest hover:underline"
          >
            {action.label} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function RevenueHeroStat({
  tier,
  total,
}: {
  tier: string;
  total: number;
  delta?: string;
  priorTotal?: number | null;
}) {
  return (
    <div
      className="rounded-2xl p-5 text-cream relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, var(--color-forest) 0%, var(--color-forest-dark, #143427) 100%)",
      }}
    >
      <span className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-gold/15 blur-2xl pointer-events-none" />
      <span className="relative inline-flex items-center rounded-full bg-cream/12 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-gold-soft">
        {tier} tier
      </span>
      <p className="relative mt-3 text-[12px] text-cream/70 font-medium">
        Estimated revenue impact
      </p>
      <p className="relative mt-1 font-display text-[34px] font-medium leading-none tracking-tight">
        {fmtUSD(total)}
      </p>
      <p className="relative mt-2 text-[11.5px] text-cream/70 italic font-serif">
        last {WINDOW_DAYS}d · tracked + modeled
      </p>
    </div>
  );
}

function RevStat({
  label,
  value,
  delta,
  period,
}: {
  label: string;
  value: string;
  delta: { dir: "up" | "down"; text: string } | null;
  period: string;
}) {
  return (
    <div className="rounded-2xl border border-border-base bg-paper p-5">
      <p className="text-[12px] text-text-soft font-medium">{label}</p>
      <p className="mt-1 font-display text-[28px] font-medium leading-none text-ink tracking-tight">
        {value}
      </p>
      <div className="mt-2 flex items-baseline gap-2 text-[11.5px]">
        {delta && (
          <span
            className={`font-medium ${
              delta.dir === "up" ? "text-success" : "text-alert"
            }`}
          >
            {delta.text}
          </span>
        )}
        <span className="text-text-muted">{period}</span>
      </div>
    </div>
  );
}

function PipelineTile({
  n,
  label,
  highlight = false,
}: {
  n: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl py-3 px-2 text-center ${
        highlight ? "bg-gold/14 border border-gold/40" : "bg-cream-deep"
      }`}
    >
      <div
        className={`font-display text-[22px] font-medium leading-none ${
          highlight ? "text-gold-dark" : "text-ink"
        }`}
      >
        {n}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-text-muted font-medium">
        {label}
      </div>
    </div>
  );
}

function ServiceRecoveryAlert({
  lowReviews,
  unreadFeedback,
  firstLocationId,
}: {
  lowReviews: number;
  unreadFeedback: number;
  firstLocationId: string | null;
}) {
  const parts: string[] = [];
  if (unreadFeedback > 0)
    parts.push(
      `${unreadFeedback} private feedback (${unreadFeedback} unread)`,
    );
  if (lowReviews > 0)
    parts.push(`${lowReviews} low-rating Google review${lowReviews === 1 ? "" : "s"}`);
  const total = lowReviews + unreadFeedback;
  return (
    <div
      role="alert"
      className="flex items-center gap-4 rounded-2xl border border-alert/30 bg-alert/5 px-5 py-4"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-alert/15 text-alert">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <div className="flex-1 space-y-0.5">
        <p className="text-[14.5px] text-ink font-medium">
          {total} item{total === 1 ? "" : "s"} need your attention
        </p>
        <p className="text-[13px] text-text-soft">
          {parts.join(" and ")} — open the inbox to triage.
        </p>
      </div>
      <Link
        href={
          firstLocationId
            ? `/app/locations/${firstLocationId}/reviews`
            : "/app/reviews"
        }
        className="inline-flex items-center gap-1 rounded-md bg-alert text-cream px-3 py-1.5 text-[12.5px] font-medium hover:bg-alert/90"
      >
        Review now <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function ActivityRow({
  item,
  locationName,
}: {
  item: {
    key: string;
    kind: "referral" | "review" | "completed" | "feedback" | "sent";
    name: string;
    meta: string;
    channelLabel: string;
    lang: string | null;
    at: string;
  };
  locationName: Map<string, string>;
}) {
  void locationName;
  const dotClass =
    item.kind === "referral"
      ? "bg-gradient-to-br from-gold to-gold-dark"
      : item.kind === "review" || item.kind === "completed"
        ? "bg-success"
        : item.kind === "feedback"
          ? "bg-warn"
          : "bg-sage";
  return (
    <li className="grid grid-cols-[10px_1fr_auto_auto] gap-3 items-center py-2.5 text-[13px]">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <div className="min-w-0">
        <p className="text-ink font-medium truncate">{item.name}</p>
        <p className="text-[11.5px] text-text-muted truncate">{item.meta}</p>
      </div>
      <span className="text-[11.5px] text-text-soft hidden md:inline-block">
        {item.channelLabel}
      </span>
      <span className="text-[11.5px] text-text-muted whitespace-nowrap font-mono">
        {relativeTime(item.at)}
      </span>
    </li>
  );
}

function SharePreviewCard({
  review,
  location,
  brandColor,
}: {
  review: {
    rating: number;
    comment: string | null;
    reviewer_display_name: string | null;
  };
  location: {
    display_name: string;
    address: string | null;
  };
  brandColor: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 text-cream relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${brandColor} 0%, ${darken(brandColor)} 100%)`,
      }}
    >
      <span className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-gold/20 blur-3xl pointer-events-none" />
      <span className="relative inline-flex items-center gap-1.5 rounded-full bg-cream/15 px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.1em]">
        <Star className="h-3 w-3 text-gold fill-gold" />
        Recommended by a customer
      </span>
      <p className="relative mt-3 text-gold text-[16px] tracking-[3px]">
        {"★".repeat(review.rating)}
      </p>
      <p className="relative mt-2 font-serif text-[13.5px] leading-relaxed line-clamp-5 z-10">
        &ldquo;{review.comment}&rdquo;
      </p>
      <p className="relative mt-3 flex items-center gap-2 text-[11px] text-cream/75 z-10">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cream/20 text-[9px] font-semibold">
          {initialsFrom(review.reviewer_display_name)}
        </span>
        — {review.reviewer_display_name ?? "Verified customer"}
      </p>
      <div className="relative mt-3 rounded-lg bg-cream/8 px-3 py-2 flex items-center gap-2.5 z-10">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-cream text-ink text-[12px] font-semibold">
          {location.display_name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-[11.5px] font-medium leading-tight truncate">
            {location.display_name}
          </p>
          {location.address && (
            <p className="text-[10px] text-cream/55 truncate">
              {location.address}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function OfferPreviewCard({
  offer,
  brandColor,
}: {
  offer: ReferralConfig;
  brandColor: string;
}) {
  const title = offer?.offer_title || "$20 Off your first visit";
  const subtitle = offer?.offer_subtitle || "Use this coupon code";
  const code = offer?.offer_code || "FRIEND20";
  const ctaLabel = offer?.cta_label || "Book with this offer →";
  const imageUrl = offer?.offer_image_url;
  return (
    <div
      className="rounded-2xl p-2.5"
      style={{
        background: `linear-gradient(135deg, ${brandColor} 0%, ${darken(brandColor)} 100%)`,
      }}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/15 text-cream px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] ml-1 mt-1 mb-2">
        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
        Limited offer
      </span>
      <div className="rounded-xl bg-paper p-3 pb-3.5">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="w-full aspect-[16/9] object-cover rounded-md mb-2.5"
          />
        ) : (
          <div className="w-full aspect-[16/9] rounded-md mb-2.5 bg-gradient-to-br from-gold-soft to-sage-soft" />
        )}
        <p className="font-display text-[16px] font-medium text-ink leading-tight">
          {title}
        </p>
        <p className="text-[11px] text-text-soft mt-0.5 mb-2.5">{subtitle}</p>
        <div className="flex items-center gap-2 mb-2.5">
          <span
            className="font-mono text-[11.5px] font-bold tracking-[1px] px-2.5 py-1 rounded-md border-[1.5px] border-dashed"
            style={{
              color: darken(brandColor),
              borderColor: brandColor,
              background: tintWhite(brandColor),
            }}
          >
            {code}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md bg-ink text-cream text-[10.5px] font-medium px-2.5 py-1.5"
          >
            Copy
          </button>
        </div>
        <button
          type="button"
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-full text-cream text-[11px] font-medium py-2"
          style={{ background: brandColor }}
        >
          <MessageSquareReply className="h-3 w-3" />
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-10 max-w-3xl space-y-5">
      <div className="space-y-1">
        <h2 className="font-display text-[20px] text-ink">
          Nothing here yet — let&apos;s send your first review request.
        </h2>
        <p className="text-[14px] text-text-soft leading-relaxed">
          Funnel, revenue impact, and the activity feed appear once you&apos;ve
          sent a request, printed a QR poster, or pasted the embed snippet on
          your website.
        </p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Link
          href="/app/send"
          className="inline-flex items-center gap-1.5 rounded-lg bg-forest text-cream px-3.5 py-2 text-[13.5px] font-medium hover:bg-forest-dark"
        >
          <Send className="h-3.5 w-3.5" />
          Send a request
        </Link>
        <Link
          href="/app/locations"
          className="inline-flex items-center gap-1.5 rounded-lg bg-paper border border-border-base px-3.5 py-2 text-[13.5px] font-medium text-text hover:bg-hover"
        >
          <Star className="h-3.5 w-3.5" />
          QR poster
        </Link>
        <Link
          href="/app/share"
          className="inline-flex items-center gap-1.5 rounded-lg bg-paper border border-border-base px-3.5 py-2 text-[13.5px] font-medium text-text hover:bg-hover"
        >
          <Code className="h-3.5 w-3.5" />
          Widget &amp; embed
        </Link>
        <Link
          href="/app/referrals"
          className="inline-flex items-center gap-1.5 rounded-lg bg-paper border border-border-base px-3.5 py-2 text-[13.5px] font-medium text-text hover:bg-hover"
        >
          <Users className="h-3.5 w-3.5" />
          Set up referrals
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function greetingPart(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function initialsFrom(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

/**
 * Darken a hex color by mixing toward black. Used to build the diagonal
 * gradient on the share/offer preview cards from the location's brand_color.
 */
function darken(hex: string): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return hex;
  const r = Math.max(0, parseInt(cleaned.slice(0, 2), 16) - 30);
  const g = Math.max(0, parseInt(cleaned.slice(2, 4), 16) - 30);
  const b = Math.max(0, parseInt(cleaned.slice(4, 6), 16) - 30);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Compute a very-light tint of a hex color for offer-code chip backgrounds.
 */
function tintWhite(hex: string): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return "#FAEEEC";
  const r = Math.min(255, parseInt(cleaned.slice(0, 2), 16) + 200);
  const g = Math.min(255, parseInt(cleaned.slice(2, 4), 16) + 200);
  const b = Math.min(255, parseInt(cleaned.slice(4, 6), 16) + 200);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
