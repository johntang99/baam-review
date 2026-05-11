import Link from "next/link";
import { Send, Star, Code, ArrowRight, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedLocationId } from "@/lib/selected-location";
import {
  buildFunnel,
  countBy,
  pctFormat,
  PLATFORM_LABEL,
  LANGUAGE_LABEL,
  sourceLabel,
  relativeTime,
} from "@/lib/analytics/aggregate";
import { Funnel } from "@/components/admin/funnel";
import { Breakdown } from "@/components/admin/breakdown";
import { StatCard } from "@/components/admin/stat-card";

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

  const selectedLocationId = await getSelectedLocationId();

  // RLS scopes everything to the user's account automatically.
  let requestsQuery = supabase
    .from("review_requests")
    .select(
      "id, recipient_name, language, channel, sent_at, delivered_at, clicked_at, completed_platform, completed_at, created_at, location_id, flagged_at",
    )
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });
  if (selectedLocationId)
    requestsQuery = requestsQuery.eq("location_id", selectedLocationId);
  const { data: requests } = await requestsQuery;

  const { data: locations } = await supabase
    .from("locations")
    .select("id, display_name");

  const selectedLocation = selectedLocationId
    ? (locations ?? []).find((l) => l.id === selectedLocationId) ?? null
    : null;

  const locationName = new Map(
    (locations ?? []).map((l) => [l.id, l.display_name]),
  );

  let feedbackQuery = supabase
    .from("private_feedback")
    .select("id, message, rating, created_at, language, location_id")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(5);
  if (selectedLocationId)
    feedbackQuery = feedbackQuery.eq("location_id", selectedLocationId);
  const { data: feedback } = await feedbackQuery;

  // Source attribution: page_view events carry source metadata.
  let pageViewsQuery = supabase
    .from("landing_events")
    .select("metadata")
    .eq("event_type", "page_view")
    .gte("occurred_at", sinceIso);
  if (selectedLocationId)
    pageViewsQuery = pageViewsQuery.eq("location_id", selectedLocationId);
  const { data: pageViews } = await pageViewsQuery;

  // Google reviews — all-time, for rating average + recent activity.
  let googleReviewsQuery = supabase
    .from("google_reviews")
    .select(
      "id, rating, comment, reviewer_display_name, review_create_time, reply_comment, location_id",
    )
    .order("review_create_time", { ascending: false })
    .limit(50);
  if (selectedLocationId)
    googleReviewsQuery = googleReviewsQuery.eq("location_id", selectedLocationId);
  const { data: googleReviews } = await googleReviewsQuery;

  const rs = requests ?? [];
  const sent = rs.filter((r) => r.sent_at).length;
  const delivered = rs.filter((r) => r.delivered_at).length;
  const clicked = rs.filter((r) => r.clicked_at).length;
  const completed = rs.filter((r) => r.completed_at).length;
  const flagged = rs.filter((r) => r.flagged_at).length;

  const funnel = buildFunnel([
    { key: "sent", label: "Sent", count: sent },
    { key: "delivered", label: "Delivered", count: delivered },
    { key: "clicked", label: "Clicked", count: clicked },
    { key: "completed", label: "Completed", count: completed },
  ]);

  const completionRate = sent === 0 ? 0 : completed / sent;

  const byPlatform = countBy(
    rs.filter((r) => r.completed_platform),
    (r) => r.completed_platform ?? null,
    (k) => PLATFORM_LABEL[k] ?? k,
  );

  const byLanguage = countBy(
    rs,
    (r) => r.language,
    (k) => LANGUAGE_LABEL[k] ?? k,
  );

  const bySource = countBy(
    pageViews ?? [],
    (e) => {
      const meta = (e.metadata ?? {}) as { source?: string };
      return meta.source ?? "direct";
    },
    (k) => sourceLabel(k === "direct" ? null : k),
  );

  const firstName = (profile?.full_name?.split(" ")[0]) || user?.email?.split("@")[0] || "there";

  const gr = googleReviews ?? [];
  const grRecent30 = gr.filter(
    (r) => new Date(r.review_create_time).getTime() > Date.now() - WINDOW_DAYS * 86_400_000,
  );
  const grAvg30 = grRecent30.length === 0
    ? 0
    : grRecent30.reduce((s, r) => s + r.rating, 0) / grRecent30.length;
  const grLowUnreplied = gr.filter((r) => r.rating <= 2 && !r.reply_comment);

  const hasData = (rs.length + (feedback?.length ?? 0) + gr.length) > 0;

  return (
    <main className="px-10 py-10 space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
          {selectedLocation
            ? `${selectedLocation.display_name} · last ${WINDOW_DAYS} days`
            : `All locations · last ${WINDOW_DAYS} days`}
        </p>
        <h1 className="font-display text-[30px] leading-tight text-ink">
          Hello, {firstName}.
        </h1>
        {!selectedLocation && account?.name && (
          <p className="text-[14px] text-text-soft">
            {account.name} ·{" "}
            <span className="capitalize">{account.subscription_tier}</span> plan
          </p>
        )}
      </header>

      {!hasData ? (
        <EmptyDashboard />
      ) : (
        <>
          {grLowUnreplied.length > 0 && (
            <LowRatingBanner
              count={grLowUnreplied.length}
              firstLocationId={grLowUnreplied[0].location_id}
              locationName={locationName.get(grLowUnreplied[0].location_id) ?? "your location"}
            />
          )}

          <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Sent" value={sent} />
            <StatCard
              label="Delivered"
              value={delivered}
              sub={sent ? pctFormat(delivered / sent) : undefined}
            />
            <StatCard
              label="Clicked"
              value={clicked}
              sub={sent ? pctFormat(clicked / sent) : undefined}
            />
            <StatCard
              label="Completed"
              value={completed}
              sub={pctFormat(completionRate)}
            />
            <StatCard
              label="Private feedback"
              value={feedback?.length ?? 0}
              sub={
                (feedback?.length ?? 0) > 0
                  ? "Latest in the inbox →"
                  : undefined
              }
            />
          </section>

          <section className="rounded-2xl border border-border-base bg-paper p-6 space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[18px] text-ink">Funnel</h2>
              <p className="text-[11.5px] text-text-muted">
                Sent → Delivered → Clicked → Completed
              </p>
            </div>
            <Funnel steps={funnel} topCount={sent} />
            {flagged > 0 && (
              <p className="text-[12px] text-warn pt-1">
                {flagged} request{flagged === 1 ? "" : "s"} flagged for velocity review.{" "}
                <Link href="/app/analytics" className="underline">
                  See details →
                </Link>
              </p>
            )}
          </section>

          {gr.length > 0 && (
            <GoogleReviewsCard
              reviews={gr.slice(0, 5)}
              total={gr.length}
              avg30={grAvg30}
              recentCount={grRecent30.length}
              locationName={locationName}
            />
          )}

          <section className="grid gap-4 lg:grid-cols-3">
            <Breakdown
              title="Where reviews went"
              rows={byPlatform}
              emptyMessage="No completed reviews yet."
            />
            <Breakdown
              title="By language"
              rows={byLanguage}
              emptyMessage="No requests yet."
            />
            <Breakdown
              title="By traffic source"
              rows={bySource}
              emptyMessage="No public page visits yet."
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <RecentActivity
              requests={rs.slice(0, 6)}
              locationName={locationName}
            />
            <PrivateFeedbackPeek
              feedback={feedback ?? []}
              locationName={locationName}
            />
          </section>
        </>
      )}
    </main>
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
          Funnel and breakdowns appear once you&apos;ve sent a request, printed
          a QR poster, or pasted the embed snippet on your website.
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
          href="/app/locations"
          className="inline-flex items-center gap-1.5 rounded-lg bg-paper border border-border-base px-3.5 py-2 text-[13.5px] font-medium text-text hover:bg-hover"
        >
          <Code className="h-3.5 w-3.5" />
          Embed snippet
        </Link>
      </div>
    </div>
  );
}

interface Request {
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
}

function RecentActivity({
  requests,
  locationName,
}: {
  requests: Request[];
  locationName: Map<string, string>;
}) {
  return (
    <div className="rounded-2xl border border-border-base bg-paper p-5">
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <h2 className="font-display text-[17px] text-ink">Recent requests</h2>
        <Link
          href="/app/send"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-forest hover:underline"
        >
          <Send className="h-3 w-3" />
          New
        </Link>
      </div>
      {requests.length === 0 ? (
        <p className="text-[13px] text-text-muted italic py-3">
          No requests in the last {WINDOW_DAYS} days.
        </p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-[13.5px] text-ink truncate">
                  {r.recipient_name}
                </p>
                <p className="text-[11.5px] text-text-muted truncate">
                  {locationName.get(r.location_id) ?? "—"} ·{" "}
                  {r.channel.toUpperCase()} ·{" "}
                  {LANGUAGE_LABEL[r.language] ?? r.language}
                </p>
              </div>
              <StatusPill r={r} />
              <span className="w-14 text-right text-[11.5px] text-text-muted whitespace-nowrap">
                {relativeTime(r.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ r }: { r: Request }) {
  let label = "Sent";
  let cls = "bg-cream-deep text-text-soft";
  if (r.completed_at) {
    label =
      r.completed_platform === "private_feedback"
        ? "Private"
        : "Completed";
    cls = "bg-success/15 text-success";
  } else if (r.clicked_at) {
    label = "Clicked";
    cls = "bg-forest/10 text-forest";
  } else if (r.delivered_at) {
    label = "Delivered";
    cls = "bg-sage-soft/50 text-forest-dark";
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls} whitespace-nowrap`}>
      {label}
    </span>
  );
}

function PrivateFeedbackPeek({
  feedback,
  locationName,
}: {
  feedback: { id: string; message: string; rating: number | null; created_at: string; language: string; location_id: string }[];
  locationName: Map<string, string>;
}) {
  return (
    <div className="rounded-2xl border border-border-base bg-paper p-5">
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <h2 className="font-display text-[17px] text-ink">Private feedback</h2>
        <Link
          href="/app/reviews"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-forest hover:underline"
        >
          Full inbox <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {feedback.length === 0 ? (
        <p className="text-[13px] text-text-muted italic py-3">
          None yet. Customers who&apos;d rather not post publicly show up here.
        </p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {feedback.slice(0, 4).map((f) => (
            <li key={f.id} className="py-2.5 space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11.5px] text-text-muted">
                  {locationName.get(f.location_id) ?? "—"}{" "}
                  {f.rating !== null && (
                    <>
                      ·{" "}
                      <span className="text-gold">
                        {"★".repeat(f.rating)}
                        {"☆".repeat(5 - f.rating)}
                      </span>
                    </>
                  )}
                </span>
                <span className="text-[11.5px] text-text-muted whitespace-nowrap">
                  {relativeTime(f.created_at)}
                </span>
              </div>
              <p className="text-[13px] text-text leading-snug line-clamp-2">
                {f.message}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LowRatingBanner({
  count,
  firstLocationId,
  locationName,
}: {
  count: number;
  firstLocationId: string;
  locationName: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-alert/30 bg-alert/5 p-4"
    >
      <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-alert" />
      <div className="flex-1 space-y-1">
        <p className="text-[14px] text-ink font-medium">
          {count} low-rating review{count === 1 ? "" : "s"} need a reply
        </p>
        <p className="text-[13px] text-text-soft">
          1- or 2-star reviews on Google without an owner response.{" "}
          {count === 1 ? "Start at" : "Including"}{" "}
          <Link
            href={`/app/locations/${firstLocationId}/reviews`}
            className="text-forest font-medium hover:underline"
          >
            {locationName}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

interface GoogleReview {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_display_name: string | null;
  review_create_time: string;
  reply_comment: string | null;
  location_id: string;
}

function GoogleReviewsCard({
  reviews,
  total,
  avg30,
  recentCount,
  locationName,
}: {
  reviews: GoogleReview[];
  total: number;
  avg30: number;
  recentCount: number;
  locationName: Map<string, string>;
}) {
  return (
    <section className="rounded-2xl border border-border-base bg-paper p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-display text-[18px] text-ink">
          Google reviews
        </h2>
        <div className="flex items-baseline gap-3 text-[12.5px] text-text-soft">
          {recentCount > 0 && (
            <span>
              <span className="text-gold">
                {"★".repeat(Math.round(avg30))}
                {"☆".repeat(5 - Math.round(avg30))}
              </span>{" "}
              {avg30.toFixed(1)} avg · last {WINDOW_DAYS}d
            </span>
          )}
          <span className="text-text-muted">{total} total</span>
        </div>
      </div>

      <ul className="divide-y divide-border-soft">
        {reviews.map((r) => (
          <li key={r.id} className="py-3 space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium text-ink truncate">
                {r.reviewer_display_name ?? "Anonymous"}
              </span>
              <span className="text-[11.5px] text-text-muted whitespace-nowrap">
                {relativeTime(r.review_create_time)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-gold text-[12.5px]">
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)}
              </span>
              <span className="text-[11.5px] text-text-muted">
                {locationName.get(r.location_id) ?? "—"}
              </span>
              {!r.reply_comment && r.rating <= 2 && (
                <span className="rounded-full bg-alert/12 text-alert text-[10.5px] font-medium uppercase tracking-wider px-1.5 py-0.5">
                  Needs reply
                </span>
              )}
            </div>
            {r.comment && (
              <p className="text-[13px] text-text-soft leading-snug line-clamp-2">
                {r.comment}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
