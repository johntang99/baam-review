import Link from "next/link";
import { Mail, Phone, ExternalLink, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import {
  relativeTime,
  PLATFORM_LABEL,
  LANGUAGE_LABEL,
} from "@/lib/analytics/aggregate";
import { markFeedbackRead, markFeedbackUnread } from "./actions";

export const metadata = {
  title: "Reviews — BAAM Review",
};

export const dynamic = "force-dynamic";

type Tab = "all" | "private" | "completed" | "unread";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "private", label: "Private feedback" },
  { id: "completed", label: "Completed reviews" },
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

  const { data: locations } = await supabase
    .from("locations")
    .select("id, display_name");
  const locName = new Map((locations ?? []).map((l) => [l.id, l.display_name]));

  const { data: feedback } = await supabase
    .from("private_feedback")
    .select(
      "id, message, rating, contact_email, contact_phone, language, read_at, created_at, location_id",
    )
    .order("created_at", { ascending: false });

  const { data: completed } = await supabase
    .from("review_requests")
    .select(
      "id, recipient_name, recipient_email, recipient_phone, language, channel, completed_platform, completed_at, location_id",
    )
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });

  const unreadCount = (feedback ?? []).filter((f) => !f.read_at).length;
  const tabCounts: Record<Tab, number> = {
    all: (feedback?.length ?? 0) + (completed?.length ?? 0),
    private: feedback?.length ?? 0,
    completed: completed?.length ?? 0,
    unread: unreadCount,
  };

  return (
    <main className="px-10 py-10 space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="Reviews"
        description="Completed Google / Yelp posts and private feedback from your review pages, in one place."
      />

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
        {tab === "completed" ? (
          <CompletedList
            items={completed ?? []}
            locName={locName}
            emptyMessage="No completed reviews yet."
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
  locName,
}: {
  feedback: FeedbackRow[];
  completed: CompletedRow[];
  locName: Map<string, string>;
}) {
  type Item =
    | { kind: "feedback"; at: string; data: FeedbackRow }
    | { kind: "completed"; at: string; data: CompletedRow };

  const items: Item[] = [
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
        it.kind === "feedback" ? (
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
