import Link from "next/link";
import { Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const WINDOW_DAYS = 90;

interface AdvocateRow {
  advocate_request_id: string;
  recipient_name: string | null;
  share_views: number;
  review_started: number;
  review_submitted: number;
  booking_click: number;
  offer_book_click: number;
  open_in_maps_click: number;
  total_clicks: number;
  last_activity: string;
}

interface RawRow {
  advocate_request_id: string | null;
  event_type: string | null;
  created_at: string;
}

/**
 * Server component — leaderboard of top advocates over the last 90 days.
 * Same logic that previously lived at /app/analytics/advocates; kept there
 * too for backward compat with any bookmarks owners have.
 */
export async function AdvocatesTable() {
  const supabase = await createClient();
  const sinceIso = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: rows } = await supabase
    .from("referrals")
    .select("advocate_request_id, event_type, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });

  const advocateIds = Array.from(
    new Set(
      (rows ?? [])
        .map((r) => r.advocate_request_id)
        .filter((id): id is string => !!id),
    ),
  );

  const nameMap = new Map<string, string | null>();
  if (advocateIds.length > 0) {
    const { data: requests } = await supabase
      .from("review_requests")
      .select("id, recipient_name")
      .in("id", advocateIds);
    for (const r of requests ?? []) nameMap.set(r.id, r.recipient_name);
  }

  const aggregated = aggregate((rows ?? []) as RawRow[], nameMap);

  if (aggregated.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-10 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cream-deep text-text-muted">
          <Users className="h-5 w-5" />
        </div>
        <p className="font-display text-[17px] font-medium text-ink">
          No referral activity yet.
        </p>
        <p className="mt-1.5 max-w-md mx-auto text-[13.5px] text-text-soft">
          Once a customer ticks the consent box and shares their thank-you
          card, share-link clicks and conversions will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border-base bg-paper shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] text-left">
          <thead>
            <tr className="border-b border-border-soft bg-cream-deep">
              <Th>#</Th>
              <Th>Advocate</Th>
              <Th right>Share views</Th>
              <Th right>Started review</Th>
              <Th right>Posted to Google</Th>
              <Th right>Offer book clicks</Th>
              <Th right>Last activity</Th>
            </tr>
          </thead>
          <tbody>
            {aggregated.map((r, i) => (
              <tr
                key={r.advocate_request_id}
                className="border-b border-border-soft last:border-0 even:bg-cream-deep/40"
              >
                <td className="px-5 py-4">
                  {i < 3 ? (
                    <span
                      className={
                        i === 0
                          ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold text-[11px] font-semibold text-ink"
                          : i === 1
                            ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-cream-deep text-[11px] font-semibold text-ink"
                            : "inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold-soft text-[11px] font-semibold text-ink"
                      }
                    >
                      {i === 0 ? <Trophy className="h-3 w-3" /> : i + 1}
                    </span>
                  ) : (
                    <span className="font-mono text-[12.5px] text-text-muted">
                      {i + 1}
                    </span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <p className="text-[14px] font-medium text-ink">
                    {r.recipient_name ?? "Anonymous"}
                  </p>
                  <Link
                    href={`/s/${r.advocate_request_id}`}
                    target="_blank"
                    className="font-mono text-[11px] text-text-muted hover:text-forest hover:underline"
                  >
                    /s/{r.advocate_request_id.slice(0, 8)}…
                  </Link>
                </td>
                <Num n={r.share_views} />
                <Num n={r.review_started} />
                <Num n={r.review_submitted} gold={r.review_submitted > 0} />
                <Num
                  n={r.offer_book_click}
                  gold={r.offer_book_click > 0}
                />
                <td className="px-5 py-4 text-right">
                  <span className="font-mono text-[11.5px] text-text-soft">
                    {formatRelative(r.last_activity)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={
        "px-5 py-3.5 text-[11.5px] font-medium uppercase tracking-[0.14em] text-text-muted " +
        (right ? "text-right" : "")
      }
    >
      {children}
    </th>
  );
}

function Num({ n, gold = false }: { n: number; gold?: boolean }) {
  return (
    <td className="px-5 py-4 text-right">
      <span
        className={
          gold && n > 0
            ? "font-mono text-[15px] font-medium text-gold"
            : "font-mono text-[15px] text-ink"
        }
      >
        {n}
      </span>
    </td>
  );
}

function aggregate(
  rows: RawRow[],
  nameMap: Map<string, string | null>,
): AdvocateRow[] {
  const map = new Map<string, AdvocateRow>();
  for (const r of rows) {
    if (!r.advocate_request_id) continue;
    const key = r.advocate_request_id;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        advocate_request_id: key,
        recipient_name: nameMap.get(key) ?? null,
        share_views: 0,
        review_started: 0,
        review_submitted: 0,
        booking_click: 0,
        offer_book_click: 0,
        open_in_maps_click: 0,
        total_clicks: 0,
        last_activity: r.created_at,
      };
      map.set(key, entry);
    }
    switch (r.event_type) {
      case "share_view":
        entry.share_views += 1;
        break;
      case "review_started":
        entry.review_started += 1;
        entry.total_clicks += 1;
        break;
      case "review_submitted":
        entry.review_submitted += 1;
        break;
      case "booking_click":
        entry.booking_click += 1;
        entry.total_clicks += 1;
        break;
      case "offer_book_click":
        entry.offer_book_click += 1;
        entry.total_clicks += 1;
        break;
      case "open_in_maps_click":
        entry.open_in_maps_click += 1;
        entry.total_clicks += 1;
        break;
    }
    if (r.created_at > entry.last_activity)
      entry.last_activity = r.created_at;
  }
  return Array.from(map.values()).sort((a, b) => {
    // Conversions → offer-book clicks → total clicks → views
    if (b.review_submitted !== a.review_submitted)
      return b.review_submitted - a.review_submitted;
    if (b.offer_book_click !== a.offer_book_click)
      return b.offer_book_click - a.offer_book_click;
    if (b.total_clicks !== a.total_clicks) return b.total_clicks - a.total_clicks;
    return b.share_views - a.share_views;
  });
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${Math.max(1, min)}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
