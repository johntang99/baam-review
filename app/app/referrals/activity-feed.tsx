import { Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const EVENT_LABEL: Record<string, string> = {
  share_view: "viewed the share card",
  booking_click: "clicked Book (no offer)",
  open_in_maps_click: "opened in Maps",
  leave_own_click: "tapped Leave your own review",
  review_started: "started a review",
  review_submitted: "posted to Google",
  offer_view: "viewed the offer",
  offer_book_click: "clicked Book with offer",
  code_copied: "copied the discount code",
};

const EVENT_TONE: Record<string, "neutral" | "good" | "great"> = {
  share_view: "neutral",
  booking_click: "good",
  open_in_maps_click: "neutral",
  leave_own_click: "good",
  review_started: "good",
  review_submitted: "great",
  offer_view: "neutral",
  offer_book_click: "great",
  code_copied: "good",
};

interface FeedRow {
  id: string;
  event_type: string;
  advocate_request_id: string | null;
  conversion_request_id: string | null;
  referrer_host: string | null;
  created_at: string;
}

/**
 * Recent referral events for a single location. Limit to the last 100 events
 * (~14 day window is typical for an active location) so the page renders
 * quickly without pagination plumbing.
 */
export async function ActivityFeed({ locationId }: { locationId: string }) {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("referrals")
    .select(
      "id, event_type, advocate_request_id, conversion_request_id, referrer_host, created_at",
    )
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (events ?? []) as FeedRow[];

  // Resolve all referenced request IDs in one trip.
  const ids = Array.from(
    new Set(
      rows.flatMap((r) =>
        [r.advocate_request_id, r.conversion_request_id].filter(
          (x): x is string => !!x,
        ),
      ),
    ),
  );
  const nameMap = new Map<string, string | null>();
  if (ids.length > 0) {
    const { data: reqs } = await supabase
      .from("review_requests")
      .select("id, recipient_name")
      .in("id", ids);
    for (const r of reqs ?? []) nameMap.set(r.id, r.recipient_name);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-10 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cream-deep text-text-muted">
          <Activity className="h-5 w-5" />
        </div>
        <p className="font-display text-[17px] font-medium text-ink">
          No referral activity yet.
        </p>
        <p className="mt-1.5 max-w-md mx-auto text-[13.5px] text-text-soft">
          Once your reviewers start sharing their cards with friends, every
          click will appear here in real time.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const advocateName = r.advocate_request_id
          ? (nameMap.get(r.advocate_request_id) ?? "Anonymous")
          : "Anonymous";
        const friendName = r.conversion_request_id
          ? (nameMap.get(r.conversion_request_id) ?? null)
          : null;
        const tone = EVENT_TONE[r.event_type] ?? "neutral";
        const label = EVENT_LABEL[r.event_type] ?? r.event_type;

        return (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-xl border border-border-base bg-paper px-4 py-3 shadow-sm"
          >
            <Dot tone={tone} />
            <div className="min-w-0 flex-1 leading-snug">
              <p className="text-[13.5px] text-text">
                A friend of{" "}
                <span className="font-medium text-ink">{advocateName}</span>{" "}
                {label}
                {friendName && (
                  <>
                    {" — converted as "}
                    <span className="font-medium text-ink">
                      {friendName}
                    </span>
                  </>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {r.referrer_host ? `from ${r.referrer_host} · ` : ""}
                {formatRelative(r.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Dot({ tone }: { tone: "neutral" | "good" | "great" }) {
  const bg =
    tone === "great"
      ? "bg-gold"
      : tone === "good"
        ? "bg-forest"
        : "bg-border-base";
  return (
    <span
      className={`flex h-2.5 w-2.5 flex-shrink-0 rounded-full ${bg}`}
      aria-hidden="true"
    />
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
