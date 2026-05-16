import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Download,
  Check,
  Building2,
  Users,
  Clock,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/analytics/aggregate";
import { markListComplete } from "../actions";
import { DetailTable, type DetailCustomer } from "./detail-table";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

function fmtTl(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}
function fmtImpact(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}
function SideStat({
  label,
  value,
  gold = false,
}: {
  label: string;
  value: string;
  gold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[12px] text-text-soft">{label}</span>
      <span
        className={`font-mono text-[13px] font-semibold ${
          gold ? "text-gold-dark" : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
function totalSentForPct(
  rows: { status: string }[],
): number {
  return rows.filter((r) =>
    ["sent", "delivered", "opened", "clicked", "reviewed", "bounced", "optout"].includes(
      r.status,
    ),
  ).length;
}

const LAST_ACTION_LABEL: Record<string, string> = {
  sent: "Request sent",
  delivered: "Delivered, not yet opened",
  opened: "Opened, no click yet",
  clicked: "Clicked the link, didn't complete",
  reviewed: "Left a review",
  bounced: "Hard bounce — invalid contact",
  optout: "Opted out / unsubscribed",
  resent: "Second-touch sent",
};

export const metadata = { title: "List — BAAM Review" };
export const dynamic = "force-dynamic";

type StageFilter = "sent" | "delivered" | "opened" | "clicked" | "reviewed";
const STAGES: StageFilter[] = [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "reviewed",
];
const STAGE_LABEL: Record<StageFilter, string> = {
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  reviewed: "Reviewed",
};

// Cumulative reach: a customer at `clicked` also counts toward sent/
// delivered/opened. Bounced/optout customers were sent at least once.
const REACHED: Record<StageFilter, string[]> = {
  sent: ["sent", "delivered", "opened", "clicked", "reviewed", "bounced", "optout"],
  delivered: ["delivered", "opened", "clicked", "reviewed"],
  opened: ["opened", "clicked", "reviewed"],
  clicked: ["clicked", "reviewed"],
  reviewed: ["reviewed"],
};

export default async function ListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ flash?: string; filter?: string }>;
}) {
  const { id } = await params;
  const { flash, filter: filterRaw } = await searchParams;
  const filter = STAGES.includes(filterRaw as StageFilter)
    ? (filterRaw as StageFilter)
    : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/lists/${id}`);

  const { data: list } = await supabase
    .from("lists")
    .select(
      "id, name, status, customer_count, sent_at, completed_at, max_touches, location_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!list) notFound();

  const [{ data: location }, { data: customers }, { data: events }] =
    await Promise.all([
      supabase
        .from("locations")
        .select("display_name")
        .eq("id", list.location_id)
        .maybeSingle(),
      supabase
        .from("list_customers")
        .select(
          "id, name, email, phone, language, channel, status, notes, touches, selected, excluded_reason, created_at",
        )
        .eq("list_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("list_events")
        .select("list_customer_id, event_type, occurred_at")
        .eq("list_id", id)
        .order("occurred_at", { ascending: false }),
    ]);

  const rows = customers ?? [];

  // Per-customer event history (already newest-first from the query).
  const eventsByCustomer = new Map<
    string,
    { event_type: string; occurred_at: string }[]
  >();
  for (const e of events ?? []) {
    const arr = eventsByCustomer.get(e.list_customer_id);
    if (arr) arr.push(e);
    else eventsByCustomer.set(e.list_customer_id, [e]);
  }
  const lastEvent = (events ?? [])[0] ?? null;

  // §4.5 eligibility: active funnel status, not terminal, not yet reviewed,
  // touches < max, and the most recent send/resent was > 5 days ago (so we
  // don't nag someone we just emailed). daysToWait surfaces the countdown.
  const now = Date.now();
  const maxTouches = list.max_touches;
  function enrich(c: (typeof rows)[number]): DetailCustomer {
    const evs = eventsByCustomer.get(c.id) ?? [];
    const last = evs[0];
    const lastSend = evs.find(
      (e) => e.event_type === "sent" || e.event_type === "resent",
    );
    const activeStatus = ["sent", "delivered", "opened", "clicked"].includes(
      c.status,
    );
    let eligible = false;
    let daysToWait: number | null = null;
    if (
      activeStatus &&
      c.selected &&
      !c.excluded_reason &&
      c.touches < maxTouches &&
      lastSend
    ) {
      const since = now - new Date(lastSend.occurred_at).getTime();
      if (since >= FIVE_DAYS_MS) eligible = true;
      else daysToWait = Math.ceil((FIVE_DAYS_MS - since) / 86_400_000);
    }
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      language: c.language,
      channel: c.channel,
      status: c.status,
      notes: c.notes ?? "",
      lastActionLabel:
        (last && LAST_ACTION_LABEL[last.event_type]) ??
        LAST_ACTION_LABEL[c.status] ??
        "Awaiting send",
      lastActionAt: last?.occurred_at ?? null,
      eligible,
      daysToWait,
    };
  }
  const enrichedRows: DetailCustomer[] = rows.map(enrich);

  // Funnel ?filter (PG3) + smart banner (?filter=eligible) seed the table's
  // pill filter (PG4/PG5).
  const pillFromFilter =
    filterRaw === "reviewed"
      ? "reviewed"
      : filterRaw === "clicked"
        ? "clicked"
        : filterRaw === "opened"
          ? "opened"
          : filterRaw === "sent" || filterRaw === "delivered"
            ? "notopened"
            : filterRaw === "eligible"
              ? "eligible"
              : "all";

  // ---- PG5: smart-resend eligibility ----
  const eligibleCount = enrichedRows.filter((r) => r.eligible).length;

  // ---- PG7: touch-history timeline + sidebar stats + impact ----
  const evAll = events ?? [];
  const evOf = (t: string) => evAll.filter((e) => e.event_type === t);
  const earliest = (es: { occurred_at: string }[]) =>
    es.length
      ? es.reduce((m, e) => (e.occurred_at < m ? e.occurred_at : m), es[0].occurred_at)
      : null;

  const firstSendAt = earliest(evOf("sent"));
  const sentEv = evOf("sent");
  const deliveredEv = evOf("delivered");
  const reviewedEv = evOf("reviewed");
  const bouncedEv = evOf("bounced");
  const resentEv = evOf("resent");
  const firstReviewAt = earliest(reviewedEv);

  const REVIEW_VALUE = 1728; // §5: Dr. Huang research value; per-site override deferred.
  const reviewedCount = rows.filter((r) => r.status === "reviewed").length;
  const reviewedZh = rows.filter(
    (r) => r.status === "reviewed" && r.language === "zh",
  ).length;

  // Avg time-to-review: per reviewed customer, reviewed-event time minus its
  // earliest sent/resent-event time.
  const sentByCust = new Map<string, number>();
  for (const e of evAll) {
    if (e.event_type === "sent" || e.event_type === "resent") {
      const t = new Date(e.occurred_at).getTime();
      const prev = sentByCust.get(e.list_customer_id);
      if (prev === undefined || t < prev) sentByCust.set(e.list_customer_id, t);
    }
  }
  const ttrDays: number[] = [];
  for (const e of reviewedEv) {
    const s = sentByCust.get(e.list_customer_id);
    if (s) ttrDays.push((new Date(e.occurred_at).getTime() - s) / 86_400_000);
  }
  const avgTtr =
    ttrDays.length > 0
      ? ttrDays.reduce((a, b) => a + b, 0) / ttrDays.length
      : null;

  const secondTouchDue = firstSendAt
    ? new Date(new Date(firstSendAt).getTime() + FIVE_DAYS_MS)
    : null;
  const secondTouchPassed = secondTouchDue
    ? secondTouchDue.getTime() < Date.now()
    : false;

  type TL = { when: string; what: string; detail: string; state?: "active" | "future" };
  const timeline: TL[] = [];
  if (firstSendAt) {
    timeline.push({
      when: fmtTl(firstSendAt),
      what: "First send",
      detail: `${sentEv.length} customers · ${rows.filter((r) => r.channel === "email").length} email · ${rows.filter((r) => r.channel === "sms").length} SMS`,
      state: "active",
    });
  }
  if (deliveredEv.length > 0) {
    timeline.push({
      when: fmtTl(earliest(deliveredEv)!),
      what: "Delivery confirmed",
      detail: `${deliveredEv.length} delivered${bouncedEv.length ? ` · ${bouncedEv.length} bounced` : ""}`,
    });
  }
  if (firstReviewAt) {
    timeline.push({
      when: fmtTl(firstReviewAt),
      what: "First review",
      detail: "First customer left a review",
    });
  }
  if (reviewedCount > 1) {
    timeline.push({
      when: fmtTl(reviewedEv[0].occurred_at),
      what: `${reviewedCount} reviews collected`,
      detail: `${totalSentForPct(rows)} sent · ${Math.round((reviewedCount / Math.max(totalSentForPct(rows), 1)) * 100)}% completion`,
    });
  }
  if (resentEv.length > 0) {
    timeline.push({
      when: fmtTl(resentEv[0].occurred_at),
      what: "Second touch sent",
      detail: `${resentEv.length} resend${resentEv.length === 1 ? "" : "s"} fired`,
    });
  }
  if (secondTouchDue && !secondTouchPassed) {
    timeline.push({
      when: `${secondTouchDue.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()} · DUE`,
      what: "Second-touch eligible",
      detail: `${eligibleCount} customer${eligibleCount === 1 ? "" : "s"} will be ready for resend`,
      state: "future",
    });
  }

  // Funnel counts — cumulative reach per stage.
  const count = (stage: StageFilter) =>
    rows.filter((r) => REACHED[stage].includes(r.status)).length;
  const totalSent = count("sent");
  const stageCounts: Record<StageFilter, number> = {
    sent: totalSent,
    delivered: count("delivered"),
    opened: count("opened"),
    clicked: count("clicked"),
    reviewed: count("reviewed"),
  };
  const pct = (n: number) =>
    totalSent === 0 ? 0 : Math.round((n / totalSent) * 100);

  const lastTouch =
    lastEvent?.occurred_at ?? list.sent_at ?? list.completed_at ?? null;

  const statusDot =
    list.status === "active"
      ? "bg-success ring-[3px] ring-success/25 animate-pulse"
      : list.status === "completed"
        ? "bg-sage"
        : list.status === "sending"
          ? "bg-success ring-[3px] ring-success/25"
          : "bg-text-muted";
  const statusLabel =
    list.status === "active"
      ? `In flight · sent ${list.sent_at ? relativeTime(list.sent_at) : "recently"}`
      : list.status === "completed"
        ? `Completed ${list.completed_at ? relativeTime(list.completed_at) : ""}`
        : list.status === "sending"
          ? "Sending…"
          : "Draft";

  return (
    <main className="px-10 py-8 pb-16 max-w-[1280px]">
      {/* TOP BAR */}
      <div className="flex items-center justify-between gap-4 mb-7">
        <Link
          href="/app/lists"
          className="inline-flex items-center gap-1.5 text-[12px] tracking-[0.04em] text-text-muted font-medium hover:text-ink"
        >
          <ChevronLeft className="h-3 w-3" />
          Lists / <span className="text-ink">{list.name}</span>
        </Link>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled
            title="CSV export — Session 14 stretch (not required for acceptance)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-base bg-paper px-3 py-2 text-[12.5px] font-medium text-text-soft opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          {(list.status === "active" || list.status === "sending") && (
            <form action={markListComplete.bind(null, list.id)}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-base bg-paper px-3 py-2 text-[12.5px] font-medium text-text hover:bg-cream-deep"
              >
                <Check className="h-3.5 w-3.5" />
                Mark complete
              </button>
            </form>
          )}
        </div>
      </div>

      {flash && (
        <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-[13.5px] text-success">
          <Check className="h-4 w-4 flex-shrink-0" />
          {flash}
        </div>
      )}

      {/* HEADER */}
      <div className="mb-7">
        <div className="flex items-center gap-2 text-[11.5px] uppercase tracking-[0.14em] text-text-muted font-medium mb-2">
          <span className={`h-[7px] w-[7px] rounded-full ${statusDot}`} />
          {statusLabel}
        </div>
        <h1 className="font-display text-[36px] leading-[1.05] tracking-tight text-ink mb-3">
          {list.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-text-soft">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-text-muted" />
            <strong className="text-ink font-medium">
              {location?.display_name ?? "—"}
            </strong>
          </span>
          <span className="h-[3px] w-[3px] rounded-full bg-text-muted" />
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-text-muted" />
            <strong className="text-ink font-medium">{rows.length}</strong>{" "}
            customers
          </span>
          <span className="h-[3px] w-[3px] rounded-full bg-text-muted" />
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-text-muted" />
            Last touch{" "}
            <strong className="text-ink font-medium">
              {lastTouch ? relativeTime(lastTouch) : "—"}
            </strong>
          </span>
          <span className="h-[3px] w-[3px] rounded-full bg-text-muted" />
          <span className="inline-flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-text-muted" />
            Max{" "}
            <strong className="text-ink font-medium">
              {list.max_touches} touches
            </strong>
          </span>
        </div>
      </div>

      {/* FUNNEL HERO */}
      <div className="rounded-2xl border border-border-base bg-paper p-6 mb-6">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <div className="font-display text-[18px] text-ink">
              Lifecycle funnel
            </div>
            <div className="text-[12.5px] text-text-soft mt-0.5">
              Click any stage to filter customers below
            </div>
          </div>
          {filter && (
            <Link
              href={`/app/lists/${list.id}`}
              className="text-[12.5px] font-medium text-forest hover:underline"
            >
              Clear filter
            </Link>
          )}
        </div>

        <div className="grid grid-cols-5 gap-2.5 mb-5">
          {STAGES.map((stage) => {
            const active = filter === stage;
            const n = stageCounts[stage];
            const numCls =
              stage === "opened"
                ? "text-gold-dark"
                : stage === "clicked"
                  ? "text-gold-dark"
                  : stage === "reviewed"
                    ? "text-forest"
                    : "text-ink";
            return (
              <Link
                key={stage}
                href={
                  active
                    ? `/app/lists/${list.id}`
                    : `/app/lists/${list.id}?filter=${stage}`
                }
                className={`rounded-xl border p-4 text-center transition-all hover:-translate-y-px ${
                  active
                    ? "border-forest bg-paper shadow-[0_4px_12px_rgba(31,77,63,0.08)]"
                    : "border-border-base bg-cream hover:bg-cream-deep"
                }`}
              >
                <div
                  className={`font-display text-[26px] font-medium leading-none ${numCls}`}
                >
                  {n}
                </div>
                <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-muted font-semibold mt-1.5">
                  {STAGE_LABEL[stage]}
                </div>
                <div className="text-[11.5px] text-text-soft mt-1 font-mono">
                  {pct(n)}%
                </div>
              </Link>
            );
          })}
        </div>

        <div className="h-2 rounded-full bg-cream-deep overflow-hidden flex">
          {(
            [
              ["sent", "bg-sage"],
              ["delivered", "bg-forest-light"],
              ["opened", "bg-gold"],
              ["clicked", "bg-gold-dark"],
              ["reviewed", "bg-forest"],
            ] as const
          ).map(([stage, cls]) => (
            <span
              key={stage}
              className={`h-full ${cls} border-r-[1.5px] border-paper last:border-r-0`}
              style={{
                width: `${rows.length === 0 ? 0 : Math.round((stageCounts[stage] / Math.max(rows.length, 1)) * 100)}%`,
              }}
            />
          ))}
        </div>
      </div>

      {/* SMART RESEND BANNER (PG5) */}
      {eligibleCount > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink to-forest-dark px-7 py-5 mb-6 flex flex-wrap items-center justify-between gap-4">
          <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <Zap className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[16px] font-semibold text-cream">
                {eligibleCount} customer{eligibleCount === 1 ? "" : "s"}{" "}
                <em className="not-italic text-gold">eligible for resend</em>
              </div>
              <div className="text-[12.5px] text-cream/70 mt-0.5 max-w-[640px]">
                Past 5-day threshold · not yet reviewed · not opted out · under{" "}
                {list.max_touches}-touch limit. Send a precise second-touch
                email to the people who actually need a nudge.
              </div>
            </div>
          </div>
          <Link
            href={`/app/lists/${list.id}?filter=eligible`}
            className="relative inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-gold-dark hover:text-cream"
          >
            Show eligible
            <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
          </Link>
        </div>
      )}

      {/* DETAIL GRID: table + sidebar (PG7) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* CUSTOMER TABLE (PG4/5/6) */}
        <DetailTable
          listId={list.id}
          locationId={list.location_id}
          initialFilter={pillFromFilter}
          rows={enrichedRows}
        />

        {/* SIDEBAR (PG7) */}
        <aside className="rounded-2xl border border-border-base bg-paper p-6">
          <div className="font-display text-[17px] text-ink">
            Touch history
          </div>
          <div className="text-[12.5px] text-text-soft mb-5">
            Every send event for this list
          </div>

          {timeline.length === 0 ? (
            <p className="text-[13px] text-text-muted italic">
              No send events yet.
            </p>
          ) : (
            <ol className="relative pl-5">
              <span className="absolute left-[5px] top-1 bottom-1 w-px bg-border-base" />
              {timeline.map((t, i) => (
                <li key={i} className="relative pb-5 last:pb-0">
                  <span
                    className={`absolute -left-5 top-1 h-[10px] w-[10px] rounded-full border-2 ${
                      t.state === "active"
                        ? "border-gold bg-gold ring-[3px] ring-gold/20"
                        : t.state === "future"
                          ? "border-border-base bg-cream-deep"
                          : "border-sage bg-sage"
                    }`}
                  />
                  <div className="font-mono text-[10.5px] tracking-[0.02em] text-text-muted font-medium">
                    {t.when}
                  </div>
                  <div
                    className={`text-[13.5px] font-semibold mt-0.5 ${
                      t.state === "future" ? "text-text-muted" : "text-ink"
                    }`}
                  >
                    {t.what}
                  </div>
                  <div
                    className={`text-[12px] font-serif italic mt-0.5 ${
                      t.state === "future" ? "text-text-muted" : "text-text-soft"
                    }`}
                  >
                    {t.detail}
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="h-px bg-border-base my-5" />

          <div className="space-y-3.5">
            <SideStat
              label="Reviews collected"
              value={`${reviewedCount}`}
              gold
            />
            <SideStat
              label="Reviews in 中文"
              value={`${reviewedZh} / ${reviewedCount || 0}`}
            />
            <SideStat
              label="Avg time to review"
              value={avgTtr !== null ? `${avgTtr.toFixed(1)} days` : "—"}
            />
            <SideStat
              label="Eligible for resend"
              value={`${eligibleCount}`}
            />
          </div>

          <div className="mt-6 rounded-xl bg-cream-deep/60 px-5 py-4">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-text-soft font-semibold mb-1.5">
              Estimated impact so far
            </div>
            <div className="font-display text-[30px] text-forest leading-none">
              <em className="italic">{fmtImpact(reviewedCount * REVIEW_VALUE)}</em>
            </div>
            <div className="text-[12px] font-serif italic text-text-soft mt-1.5">
              {reviewedCount} review{reviewedCount === 1 ? "" : "s"} × $
              {REVIEW_VALUE.toLocaleString()} modeled value · 24-month horizon
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
