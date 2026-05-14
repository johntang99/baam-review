import Link from "next/link";
import { Mail, Phone, ExternalLink, Lock, Star, MessageSquareReply } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedLocationId } from "@/lib/selected-location";
import { PageHeader } from "@/components/admin/page-header";
import {
  relativeTime,
  PLATFORM_LABEL,
  LANGUAGE_LABEL,
} from "@/lib/analytics/aggregate";
import { markFeedbackRead, markFeedbackUnread } from "./actions";
import { SyncButton } from "./sync-button";

export const metadata = {
  title: "Reviews — BAAM Review",
};

export const dynamic = "force-dynamic";

type Tab = "all" | "google" | "private" | "completed" | "unread";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "google", label: "Google reviews" },
  { id: "private", label: "Private feedback" },
  { id: "completed", label: "Customer click-throughs" },
  { id: "unread", label: "Unread" },
];

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabRaw } = await searchParams;
  const tab: Tab = (TABS.find((t) => t.id === tabRaw)?.id) ?? "all";

  const supabase = await createClient();
  const selectedLocationId = await getSelectedLocationId();

  const { data: locations } = await supabase
    .from("locations")
    .select("id, display_name");
  const locName = new Map((locations ?? []).map((l) => [l.id, l.display_name]));
  const selectedLocation = selectedLocationId
    ? (locations ?? []).find((l) => l.id === selectedLocationId)
    : null;

  let feedbackQuery = supabase
    .from("private_feedback")
    .select(
      "id, message, rating, contact_email, contact_phone, language, read_at, created_at, location_id",
    )
    .order("created_at", { ascending: false });
  if (selectedLocationId)
    feedbackQuery = feedbackQuery.eq("location_id", selectedLocationId);
  const { data: feedback } = await feedbackQuery;

  let completedQuery = supabase
    .from("review_requests")
    .select(
      "id, recipient_name, recipient_email, recipient_phone, language, channel, completed_platform, completed_at, location_id",
    )
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });
  if (selectedLocationId)
    completedQuery = completedQuery.eq("location_id", selectedLocationId);
  const { data: completed } = await completedQuery;

  let googleReviewsQuery = supabase
    .from("google_reviews")
    .select(
      "id, google_review_id, reviewer_display_name, reviewer_profile_photo_url, rating, comment, review_create_time, reply_comment, reply_update_time, location_id",
    )
    .order("review_create_time", { ascending: false });
  if (selectedLocationId)
    googleReviewsQuery = googleReviewsQuery.eq("location_id", selectedLocationId);
  const { data: googleReviews } = await googleReviewsQuery;

  const unreadCount = (feedback ?? []).filter((f) => !f.read_at).length;
  const tabCounts: Record<Tab, number> = {
    all:
      (feedback?.length ?? 0) +
      (completed?.length ?? 0) +
      (googleReviews?.length ?? 0),
    google: googleReviews?.length ?? 0,
    private: feedback?.length ?? 0,
    completed: completed?.length ?? 0,
    unread: unreadCount,
  };

  return (
    <main className="px-10 py-10 space-y-6">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <PageHeader
          eyebrow="Inbox"
          title={selectedLocation ? `Reviews · ${selectedLocation.display_name}` : "Reviews"}
          description={
            selectedLocation
              ? "Google reviews, private feedback, and click-throughs for this location."
              : "All locations. Switch via the dropdown in the sidebar to focus on one."
          }
        />
        <SyncButton />
      </div>

      <nav className="flex gap-1 border-b border-border-base">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={`/app/reviews?tab=${t.id}`}
              className={`relative px-3 py-2 text-[13px] font-medium transition-colors ${
                active ? "text-ink" : "text-text-soft hover:text-ink"
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-[11.5px] text-text-muted tabular-nums">
                {tabCounts[t.id]}
              </span>
              {active && (
                <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-forest" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 max-w-3xl">
        {tab === "google" ? (
          <GoogleReviewsList
            items={googleReviews ?? []}
            locName={locName}
            emptyMessage="No Google reviews synced yet. Open a location and click Sync now."
          />
        ) : tab === "completed" ? (
          <CompletedList
            items={completed ?? []}
            locName={locName}
            emptyMessage="No click-throughs yet."
          />
        ) : tab === "private" ? (
          <FeedbackList
            items={feedback ?? []}
            locName={locName}
            emptyMessage="No private feedback yet. Customers who'd rather not post publicly will appear here."
          />
        ) : tab === "unread" ? (
          <FeedbackList
            items={(feedback ?? []).filter((f) => !f.read_at)}
            locName={locName}
            emptyMessage="Nothing unread."
          />
        ) : (
          // "all"
          <UnifiedList
            feedback={feedback ?? []}
            completed={completed ?? []}
            googleReviews={googleReviews ?? []}
            locName={locName}
          />
        )}
      </div>
    </main>
  );
}

interface FeedbackRow {
  id: string;
  message: string;
  rating: number | null;
  contact_email: string | null;
  contact_phone: string | null;
  language: string;
  read_at: string | null;
  created_at: string;
  location_id: string;
}

interface CompletedRow {
  id: string;
  recipient_name: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  language: string;
  channel: string;
  completed_platform: string | null;
  completed_at: string | null;
  location_id: string;
}

interface GoogleReviewRow {
  id: string;
  google_review_id: string;
  reviewer_display_name: string | null;
  reviewer_profile_photo_url: string | null;
  rating: number;
  comment: string | null;
  review_create_time: string;
  reply_comment: string | null;
  reply_update_time: string | null;
  location_id: string;
}

function GoogleReviewsList({
  items,
  locName,
  emptyMessage,
}: {
  items: GoogleReviewRow[];
  locName: Map<string, string>;
  emptyMessage: string;
}) {
  if (items.length === 0) return <EmptyState message={emptyMessage} />;
  return (
    <ul className="space-y-3">
      {items.map((r) => (
        <GoogleReviewCard key={r.id} r={r} locName={locName} />
      ))}
    </ul>
  );
}

function GoogleReviewCard({
  r,
  locName,
}: {
  r: GoogleReviewRow;
  locName: Map<string, string>;
}) {
  const low = r.rating <= 2;
  return (
    <li
      className={`rounded-2xl border bg-paper p-5 ${
        low ? "border-alert/30" : "border-border-base"
      }`}
    >
      <div className="flex items-start gap-3 mb-2">
        {r.reviewer_profile_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.reviewer_profile_photo_url}
            alt=""
            className="h-8 w-8 rounded-full flex-shrink-0 object-cover"
          />
        ) : (
          <span className="h-8 w-8 rounded-full bg-sage-soft flex-shrink-0 flex items-center justify-center text-forest-dark font-medium text-[13px]">
            {(r.reviewer_display_name ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <Star className="h-3 w-3 text-gold flex-shrink-0" />
            <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Google review
            </span>
            {low && !r.reply_comment && (
              <span className="rounded-full bg-alert/12 text-alert text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5">
                Needs reply
              </span>
            )}
          </div>
          <p className="text-[13.5px] text-ink font-medium truncate">
            {r.reviewer_display_name ?? "Anonymous"}
          </p>
          <p className="text-[11.5px] text-text-soft truncate">
            {locName.get(r.location_id) ?? "—"}
          </p>
        </div>
        <div className="flex items-baseline gap-3 flex-shrink-0">
          <span className="text-gold text-[13px] tracking-tight">
            {"★".repeat(r.rating)}
            {"☆".repeat(5 - r.rating)}
          </span>
          <span className="text-[11.5px] text-text-muted whitespace-nowrap">
            {relativeTime(r.review_create_time)}
          </span>
        </div>
      </div>

      {r.comment && (
        <p className="text-[14px] text-text leading-relaxed whitespace-pre-wrap">
          {r.comment}
        </p>
      )}

      {r.reply_comment && (
        <div className="mt-3 rounded-lg bg-cream-deep/40 p-3 text-[13px] text-text-soft space-y-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Your reply
            {r.reply_update_time && (
              <span> · {relativeTime(r.reply_update_time)}</span>
            )}
          </p>
          <p className="whitespace-pre-wrap">{r.reply_comment}</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end">
        <Link
          href={`/app/locations/${r.location_id}/reviews`}
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-forest hover:text-forest-dark hover:underline"
        >
          <MessageSquareReply className="h-4 w-4" />
          Review Reply &amp; Share
        </Link>
      </div>
    </li>
  );
}

function FeedbackList({
  items,
  locName,
  emptyMessage,
}: {
  items: FeedbackRow[];
  locName: Map<string, string>;
  emptyMessage: string;
}) {
  if (items.length === 0) return <EmptyState message={emptyMessage} />;
  return (
    <ul className="space-y-3">
      {items.map((f) => (
        <FeedbackCard key={f.id} f={f} locName={locName} />
      ))}
    </ul>
  );
}

function FeedbackCard({
  f,
  locName,
}: {
  f: FeedbackRow;
  locName: Map<string, string>;
}) {
  const unread = !f.read_at;
  return (
    <li
      className={`rounded-2xl border bg-paper p-5 ${
        unread ? "border-forest/30" : "border-border-base"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <Lock className="h-3 w-3 text-text-muted flex-shrink-0" />
            <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Private feedback
            </span>
            {unread && (
              <span className="rounded-full bg-forest/12 text-forest text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5">
                New
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-text-soft truncate">
            {locName.get(f.location_id) ?? "—"} ·{" "}
            {LANGUAGE_LABEL[f.language] ?? f.language}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {f.rating !== null && (
            <span className="text-gold text-[14px] tracking-tight">
              {"★".repeat(f.rating)}
              {"☆".repeat(5 - f.rating)}
            </span>
          )}
          <span className="text-[11.5px] text-text-muted whitespace-nowrap">
            {relativeTime(f.created_at)}
          </span>
        </div>
      </div>

      <p className="text-[14px] text-text leading-relaxed whitespace-pre-wrap">
        {f.message}
      </p>

      {(f.contact_email || f.contact_phone) && (
        <div className="mt-3 flex flex-wrap gap-3 text-[12.5px]">
          {f.contact_email && (
            <a
              href={`mailto:${f.contact_email}`}
              className="inline-flex items-center gap-1 text-forest hover:underline"
            >
              <Mail className="h-3.5 w-3.5" />
              {f.contact_email}
            </a>
          )}
          {f.contact_phone && (
            <a
              href={`tel:${f.contact_phone}`}
              className="inline-flex items-center gap-1 text-forest hover:underline"
            >
              <Phone className="h-3.5 w-3.5" />
              {f.contact_phone}
            </a>
          )}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        {unread ? (
          <form action={markFeedbackRead.bind(null, f.id)}>
            <button
              type="submit"
              className="text-[12px] text-text-soft hover:text-ink"
            >
              Mark as read
            </button>
          </form>
        ) : (
          <form action={markFeedbackUnread.bind(null, f.id)}>
            <button
              type="submit"
              className="text-[12px] text-text-soft hover:text-ink"
            >
              Mark unread
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

function CompletedList({
  items,
  locName,
  emptyMessage,
}: {
  items: CompletedRow[];
  locName: Map<string, string>;
  emptyMessage: string;
}) {
  if (items.length === 0) return <EmptyState message={emptyMessage} />;
  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <CompletedCard key={r.id} r={r} locName={locName} />
      ))}
    </ul>
  );
}

function CompletedCard({
  r,
  locName,
}: {
  r: CompletedRow;
  locName: Map<string, string>;
}) {
  const platform = r.completed_platform ?? "google";
  const platformLabel = PLATFORM_LABEL[platform] ?? platform;
  return (
    <li className="rounded-xl border border-border-base bg-paper p-4 flex items-center gap-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          {platform === "private_feedback" ? (
            <Lock className="h-3 w-3 text-text-muted flex-shrink-0" />
          ) : (
            <ExternalLink className="h-3 w-3 text-success flex-shrink-0" />
          )}
          <p className="text-[13.5px] text-ink truncate">{r.recipient_name}</p>
        </div>
        <p className="text-[11.5px] text-text-muted truncate">
          {locName.get(r.location_id) ?? "—"} ·{" "}
          {r.channel.toUpperCase()} ·{" "}
          {LANGUAGE_LABEL[r.language] ?? r.language}
        </p>
      </div>
      <span className="rounded-full bg-success/12 text-success text-[11px] font-medium px-2 py-0.5 whitespace-nowrap">
        {platformLabel}
      </span>
      <span className="w-16 text-right text-[11.5px] text-text-muted whitespace-nowrap">
        {relativeTime(r.completed_at)}
      </span>
    </li>
  );
}

function UnifiedList({
  feedback,
  completed,
  googleReviews,
  locName,
}: {
  feedback: FeedbackRow[];
  completed: CompletedRow[];
  googleReviews: GoogleReviewRow[];
  locName: Map<string, string>;
}) {
  type Item =
    | { kind: "google"; at: string; data: GoogleReviewRow }
    | { kind: "feedback"; at: string; data: FeedbackRow }
    | { kind: "completed"; at: string; data: CompletedRow };

  const items: Item[] = [
    ...googleReviews.map((g) => ({
      kind: "google" as const,
      at: g.review_create_time,
      data: g,
    })),
    ...feedback.map((f) => ({
      kind: "feedback" as const,
      at: f.created_at,
      data: f,
    })),
    ...completed
      .filter((c) => c.completed_at)
      .map((c) => ({
        kind: "completed" as const,
        at: c.completed_at!,
        data: c,
      })),
  ].sort((a, b) => (a.at > b.at ? -1 : 1));

  if (items.length === 0) {
    return (
      <EmptyState message="No reviews or feedback yet. Send a request, print a QR poster, or paste the embed snippet to start collecting." />
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((it) =>
        it.kind === "google" ? (
          <GoogleReviewCard
            key={`g-${it.data.id}`}
            r={it.data}
            locName={locName}
          />
        ) : it.kind === "feedback" ? (
          <FeedbackCard key={`f-${it.data.id}`} f={it.data} locName={locName} />
        ) : (
          <CompletedCard key={`c-${it.data.id}`} r={it.data} locName={locName} />
        ),
      )}
    </ul>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-8 text-center text-[13.5px] text-text-soft">
      {message}
    </div>
  );
}
