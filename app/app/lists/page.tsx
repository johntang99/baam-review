import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getInternalContext,
  getVisibleLocationIds,
} from "@/lib/auth/staff";
import { relativeTime } from "@/lib/analytics/aggregate";
import { ListsSearchInput } from "./search-input";

export const metadata = {
  title: "Lists — BAAM Review",
};

export const dynamic = "force-dynamic";

type Filter = "all" | "active" | "resend" | "drafts" | "completed";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "resend", label: "Awaiting resend" },
  { id: "drafts", label: "Drafts" },
  { id: "completed", label: "Completed" },
];

const ACTIVE_FUNNEL_STATUSES = new Set([
  "sent",
  "delivered",
  "opened",
  "clicked",
]);
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface ListRow {
  id: string;
  name: string;
  status: "draft" | "sending" | "active" | "completed" | "archived";
  default_language: string;
  customer_count: number;
  sent_at: string | null;
  completed_at: string | null;
  created_at: string;
  max_touches: number;
  location_id: string;
}

interface CustomerRow {
  id: string;
  list_id: string;
  status: string;
  touches: number;
}

export default async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; flash?: string; q?: string }>;
}) {
  const { filter: filterRaw, flash, q: qRaw } = await searchParams;
  const filter: Filter =
    FILTERS.find((f) => f.id === filterRaw)?.id ?? "all";
  const q = (qRaw ?? "").trim().toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/lists");

  const internal = await getInternalContext(supabase, user.id);
  const visibleIds = await getVisibleLocationIds(supabase, internal);
  const idFilter =
    visibleIds === null
      ? null
      : visibleIds.length > 0
        ? visibleIds
        : ["00000000-0000-0000-0000-000000000000"];

  let listsQuery = supabase
    .from("lists")
    .select(
      "id, name, status, default_language, customer_count, sent_at, completed_at, created_at, max_touches, location_id",
    )
    .order("created_at", { ascending: false });
  if (idFilter) listsQuery = listsQuery.in("location_id", idFilter);

  let locationsQuery = supabase.from("locations").select("id, display_name");
  if (idFilter) locationsQuery = locationsQuery.in("id", idFilter);

  const [{ data: lists }, { data: locations }] = await Promise.all([
    listsQuery,
    locationsQuery,
  ]);

  const allLists = (lists ?? []) as ListRow[];
  const locName = new Map(
    (locations ?? []).map((l) => [l.id, l.display_name]),
  );

  // Per-list customer state. Aggregated in JS — lists never exceed ~500 rows
  // each and the managed-service footprint is a handful of lists, so this is
  // well within the plan's client-side-aggregation guidance (§2.2).
  const listIds = allLists.map((l) => l.id);
  let customers: CustomerRow[] = [];
  let lastSendByCustomer = new Map<string, number>();
  if (listIds.length > 0) {
    const { data: custRows } = await supabase
      .from("list_customers")
      .select("id, list_id, status, touches")
      .in("list_id", listIds);
    customers = (custRows ?? []) as CustomerRow[];

    // Most-recent send/resend event per customer → drives resend eligibility.
    const { data: sendEvents } = await supabase
      .from("list_events")
      .select("list_customer_id, occurred_at, event_type")
      .in("list_id", listIds)
      .in("event_type", ["sent", "resent"]);
    lastSendByCustomer = new Map();
    for (const e of sendEvents ?? []) {
      const t = new Date(e.occurred_at).getTime();
      const prev = lastSendByCustomer.get(e.list_customer_id) ?? 0;
      if (t > prev) lastSendByCustomer.set(e.list_customer_id, t);
    }
  }

  const custByList = new Map<string, CustomerRow[]>();
  for (const c of customers) {
    const arr = custByList.get(c.list_id);
    if (arr) arr.push(c);
    else custByList.set(c.list_id, [c]);
  }

  // ---- Per-list derived metrics ----
  function statusCounts(listId: string) {
    const c = custByList.get(listId) ?? [];
    const counts = {
      total: c.length,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      reviewed: 0,
      pending: 0,
    };
    for (const cu of c) {
      if (cu.status === "pending" || cu.status === "excluded")
        counts.pending += 1;
      if (
        ["sent", "delivered", "opened", "clicked", "reviewed"].includes(
          cu.status,
        )
      )
        counts.sent += 1;
      if (["delivered", "opened", "clicked", "reviewed"].includes(cu.status))
        counts.delivered += 1;
      if (["opened", "clicked", "reviewed"].includes(cu.status))
        counts.opened += 1;
      if (["clicked", "reviewed"].includes(cu.status)) counts.clicked += 1;
      if (cu.status === "reviewed") counts.reviewed += 1;
    }
    return counts;
  }

  function eligibleForResend(list: ListRow): number {
    if (list.status !== "active") return 0;
    const c = custByList.get(list.id) ?? [];
    const now = Date.now();
    let n = 0;
    for (const cu of c) {
      if (!ACTIVE_FUNNEL_STATUSES.has(cu.status)) continue;
      if (cu.touches >= list.max_touches) continue;
      const lastSend = lastSendByCustomer.get(cu.id);
      if (lastSend && now - lastSend >= FIVE_DAYS_MS) n += 1;
    }
    return n;
  }

  // ---- KPI strip ----
  const activeLists = allLists.filter((l) => l.status === "active");
  const activeClientCount = new Set(
    activeLists.map((l) => l.location_id),
  ).size;

  const now = Date.now();
  let inFlight = 0;
  for (const l of allLists) {
    if (!l.sent_at) continue;
    if (now - new Date(l.sent_at).getTime() > FOURTEEN_DAYS_MS) continue;
    const c = custByList.get(l.id) ?? [];
    inFlight += c.filter((cu) =>
      ACTIVE_FUNNEL_STATUSES.has(cu.status),
    ).length;
  }

  const totalEligible = allLists.reduce(
    (s, l) => s + eligibleForResend(l),
    0,
  );

  // Completion rate: reviewed / sent across lists sent in the trailing 30d.
  let sent30 = 0;
  let reviewed30 = 0;
  for (const l of allLists) {
    if (!l.sent_at) continue;
    if (now - new Date(l.sent_at).getTime() > THIRTY_DAYS_MS) continue;
    const sc = statusCounts(l.id);
    sent30 += sc.sent;
    reviewed30 += sc.reviewed;
  }
  const completionRate =
    sent30 === 0 ? 0 : Math.round((reviewed30 / sent30) * 100);

  // ---- Filter pill counts ----
  const counts: Record<Filter, number> = {
    all: allLists.length,
    active: activeLists.length,
    resend: allLists.filter((l) => eligibleForResend(l) > 0).length,
    drafts: allLists.filter((l) => l.status === "draft").length,
    completed: allLists.filter((l) => l.status === "completed").length,
  };

  const visibleLists = allLists.filter((l) => {
    // Status tab.
    if (filter === "all") {
      if (l.status === "archived") return false;
    } else if (filter === "active") {
      if (l.status !== "active") return false;
    } else if (filter === "resend") {
      if (!(eligibleForResend(l) > 0)) return false;
    } else if (filter === "drafts") {
      if (l.status !== "draft") return false;
    } else if (filter === "completed") {
      if (l.status !== "completed") return false;
    }
    // Free-text search: list name OR the attached client (location) name.
    // Empty q passes everything through.
    if (!q) return true;
    if (l.name.toLowerCase().includes(q)) return true;
    const locationName = locName.get(l.location_id) ?? "";
    if (locationName.toLowerCase().includes(q)) return true;
    return false;
  });

  return (
    <main className="px-10 py-8 pb-16 max-w-[1280px]">
      {/* TOP BAR */}
      <div className="flex items-center justify-between gap-4 mb-7">
        <p className="text-[12px] uppercase tracking-[0.08em] text-text-muted font-medium">
          Workspace · Lists
        </p>
        <Link
          href="/app/lists/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2.5 text-[13.5px] font-medium text-cream hover:bg-forest-dark"
        >
          <Plus className="h-3.5 w-3.5" />
          New list
        </Link>
      </div>

      {/* PAGE HEADER */}
      <div className="mb-8">
        <p className="text-[11.5px] uppercase tracking-[0.14em] text-text-muted font-medium mb-2">
          For managed customers
        </p>
        <h1 className="font-display text-[42px] leading-[1.05] tracking-tight text-ink mb-2.5">
          Lists.
        </h1>
        <p className="font-serif italic text-[17px] text-text-soft max-w-[600px] leading-relaxed">
          Customer batches your clients send you each week. Import once, send
          to all, track every step, resend only to the right people.
        </p>
      </div>

      {flash && (
        <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-[13.5px] text-success">
          <Check className="h-4 w-4 flex-shrink-0" />
          {flash}
        </div>
      )}

      {/* STATS STRIP */}
      <div className="flex gap-7 px-7 py-5 bg-paper border border-border-base rounded-2xl mb-8 flex-col sm:flex-row">
        <KpiMini
          num={String(activeLists.length)}
          label="Active lists"
          sub={`across ${activeClientCount} client${activeClientCount === 1 ? "" : "s"}`}
        />
        <KpiDivider />
        <KpiMini
          num={String(inFlight)}
          numClass="text-gold-dark"
          label="Customers in flight"
          sub="sent in last 14 days"
        />
        <KpiDivider />
        <KpiMini
          num={String(totalEligible)}
          numClass="text-warn"
          label="Eligible for resend"
          sub="past 5-day threshold"
        />
        <KpiDivider />
        <KpiMini
          num={`${completionRate}%`}
          label="Completion rate"
          sub="trailing 30 days"
        />
      </div>

      {/* FILTERS */}
      <div className="flex gap-4 items-center mb-6 flex-wrap">
        <span className="text-[11.5px] uppercase tracking-[0.1em] text-text-muted font-medium">
          Show
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => {
            const active = f.id === filter;
            return (
              <Link
                key={f.id}
                href={f.id === "all" ? "/app/lists" : `/app/lists?filter=${f.id}`}
                className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-ink text-cream border-ink"
                    : "bg-paper text-text-soft border-border-base hover:border-forest"
                }`}
              >
                {f.label}
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-px text-[10.5px] font-mono ${
                    active
                      ? "bg-cream/20 text-cream"
                      : "bg-cream-deep text-text-muted"
                  }`}
                >
                  {counts[f.id]}
                </span>
              </Link>
            );
          })}
        </div>
        <ListsSearchInput initial={qRaw ?? ""} />
      </div>

      {/* LIST CARDS */}
      {visibleLists.length === 0 ? (
        <EmptyState filtered={filter !== "all"} />
      ) : (
        <div className="flex flex-col gap-3.5">
          {visibleLists.map((l) => {
            const sc = statusCounts(l.id);
            const elig = eligibleForResend(l);
            const isDraft = l.status === "draft";
            const isCompleted = l.status === "completed";
            const href = isDraft
              ? `/app/lists/${l.id}/review`
              : `/app/lists/${l.id}`;
            return (
              <Link
                key={l.id}
                href={href}
                className={`grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-7 items-center rounded-2xl border p-6 transition-all hover:-translate-y-px hover:border-forest hover:shadow-[0_8px_24px_rgba(15,31,26,0.06)] ${
                  isDraft
                    ? "bg-cream-deep border-dashed border-border-base"
                    : "bg-paper border-border-base"
                }`}
              >
                <div className="flex gap-4 items-start min-w-0">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                      l.status === "active"
                        ? "bg-success ring-[3px] ring-success/20"
                        : l.status === "completed"
                          ? "bg-sage"
                          : elig > 0
                            ? "bg-warn ring-[3px] ring-warn/20"
                            : "bg-text-muted ring-[3px] ring-text-muted/15"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gold-dark">
                        {locName.get(l.location_id) ?? "—"}
                      </span>
                      <span className="h-[3px] w-[3px] rounded-full bg-text-muted" />
                      <span className="text-[12px] text-text-muted">
                        {l.sent_at
                          ? `Sent ${relativeTime(l.sent_at)} · ${sc.total} customer${sc.total === 1 ? "" : "s"}`
                          : `Created ${relativeTime(l.created_at)} · ${sc.total} customer${sc.total === 1 ? "" : "s"} imported`}
                      </span>
                    </div>
                    <div className="font-display text-[19px] font-medium tracking-tight text-ink leading-tight mb-2">
                      {l.name}
                    </div>
                    <div className="flex items-center gap-1.5 font-serif italic text-[13.5px] text-text-soft">
                      <NextActionPill
                        list={l}
                        eligible={elig}
                      />
                      <span>
                        {isDraft
                          ? "Review and send when ready"
                          : isCompleted
                            ? `${sc.reviewed} review${sc.reviewed === 1 ? "" : "s"} collected`
                            : elig > 0
                              ? `${elig} customer${elig === 1 ? "" : "s"} eligible for second-touch email`
                              : "Reviews still coming in · check back soon"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* FUNNEL */}
                <div
                  className={`min-w-0 ${isDraft ? "opacity-50" : isCompleted ? "opacity-90" : ""}`}
                >
                  <div className="grid grid-cols-5 gap-1.5 mb-2">
                    <FunnelStep
                      n={isDraft ? sc.total : sc.sent}
                      label={isDraft ? "Pending" : "Sent"}
                      dim={isDraft}
                    />
                    <FunnelStep n={isDraft ? null : sc.delivered} label="Delivered" dim={isDraft} />
                    <FunnelStep n={isDraft ? null : sc.opened} label="Opened" gold={!isDraft && sc.opened > 0} dim={isDraft} />
                    <FunnelStep n={isDraft ? null : sc.clicked} label="Clicked" gold={!isDraft && sc.clicked > 0} dim={isDraft} />
                    <FunnelStep n={isDraft ? null : sc.reviewed} label="Reviewed" dim={isDraft} />
                  </div>
                  <div className="h-1.5 rounded-full bg-cream-deep overflow-hidden flex">
                    {!isDraft && sc.sent > 0 && (
                      <>
                        <span
                          className="h-full bg-sage border-r-[1.5px] border-paper"
                          style={{ width: `${pct(sc.sent, sc.total)}%` }}
                        />
                        <span
                          className="h-full bg-forest-light border-r-[1.5px] border-paper"
                          style={{ width: `${pct(sc.delivered, sc.total)}%` }}
                        />
                        <span
                          className="h-full bg-gold border-r-[1.5px] border-paper"
                          style={{ width: `${pct(sc.opened, sc.total)}%` }}
                        />
                        <span
                          className="h-full bg-gold-dark border-r-[1.5px] border-paper"
                          style={{ width: `${pct(sc.clicked, sc.total)}%` }}
                        />
                        <span
                          className="h-full bg-forest"
                          style={{ width: `${pct(sc.reviewed, sc.total)}%` }}
                        />
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((n / total) * 100));
}

function KpiMini({
  num,
  numClass = "text-ink",
  label,
  sub,
}: {
  num: string;
  numClass?: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex-1">
      <div
        className={`font-display text-[30px] font-normal leading-none tracking-tight mb-1 ${numClass}`}
      >
        {num}
      </div>
      <div className="text-[11.5px] uppercase tracking-[0.08em] text-text-muted font-medium">
        {label}
      </div>
      <div className="text-[11.5px] text-text-soft mt-1 font-serif italic">
        {sub}
      </div>
    </div>
  );
}

function KpiDivider() {
  return <div className="w-px bg-border-base hidden sm:block" />;
}

function FunnelStep({
  n,
  label,
  gold = false,
  dim = false,
}: {
  n: number | null;
  label: string;
  gold?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={`font-display text-[22px] font-medium tracking-tight leading-none ${
          dim ? "text-text-muted" : gold ? "text-gold-dark" : "text-ink"
        }`}
      >
        {n === null ? "—" : n}
      </div>
      <div className="text-[10px] uppercase tracking-[0.05em] text-text-muted mt-1 font-medium">
        {label}
      </div>
    </div>
  );
}

function NextActionPill({
  list,
  eligible,
}: {
  list: ListRow;
  eligible: number;
}) {
  let text = "DRAFT";
  let cls = "bg-cream-deep text-text-soft";
  if (list.status === "completed") {
    text = "COMPLETED";
    cls = "bg-success-soft text-success";
  } else if (list.status === "active" && eligible > 0) {
    text = "RESEND READY";
    cls = "bg-warn-soft text-warn";
  } else if (list.status === "active") {
    text = "IN FLIGHT";
    cls = "bg-success-soft text-success";
  } else if (list.status === "sending") {
    text = "SENDING";
    cls = "bg-success-soft text-success";
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 not-italic font-sans font-semibold text-[11px] tracking-[0.02em] ${cls}`}
    >
      {text}
    </span>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-12 text-center">
      <p className="font-display text-[18px] text-ink mb-1.5">
        {filtered ? "No lists match this filter." : "No lists yet."}
      </p>
      <p className="text-[14px] text-text-soft mb-6">
        {filtered
          ? "Try a different filter, or create a new batch."
          : "Click New list to import your first batch of customers."}
      </p>
      <Link
        href="/app/lists/new"
        className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2.5 text-[13.5px] font-medium text-cream hover:bg-forest-dark"
      >
        <Plus className="h-3.5 w-3.5" />
        New list
      </Link>
    </div>
  );
}
