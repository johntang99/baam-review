import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readMarketingDoc } from "@/lib/marketing/render";
import { canUserAudit } from "@/lib/audit/quotas";
import { AuditTopNav } from "@/components/audit/audit-top-nav";
import { ServiceBanner } from "./service-banner";

export const metadata = { title: "Your audits · BAAM Review Audit" };
export const dynamic = "force-dynamic";

interface AuditRow {
  id: string;
  business_place_id: string | null;
  vertical: string | null;
  tier: string | null;
  total_score: number | null;
  grade: string | null;
  languages_rendered: string[];
  pdf_urls: Record<string, string>;
  generated_at: string;
  status: "generating" | "complete" | "failed";
  progress_stage: number;
  failed_reason: string | null;
  google_data: {
    business?: { name?: string; name_secondary?: string; city?: string; state?: string };
    language?: { is_chinese_business?: boolean };
  } | null;
  score_data: { weakest_component?: string; grade_diagnosis?: string } | null;
}

const VERTICAL_LABELS: Record<string, string> = {
  tcm_clinic: "TCM clinic",
  dental: "Dental practice",
  legal_immigration: "Immigration law",
  restaurant: "Restaurant",
  real_estate: "Real estate",
  hotel: "Hotel",
  auto: "Auto",
  contractor: "Contractor",
  salon_spa: "Salon / spa",
  cafe: "Café",
  apparel: "Apparel",
  health_food: "Health food",
  insurance: "Insurance",
  general_smb: "Local business",
};

export default async function AuditListPage(props: {
  searchParams: Promise<{ business?: string }>;
}) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    redirect("/login?next=/audit/list");
  }

  const params = await props.searchParams;
  const businessFilter = params.business ?? null;

  const { css } = readMarketingDoc("audit-list.html");
  const quota = await canUserAudit(authData.user.id);

  const { data: audits } = await supabase
    .from("audits")
    .select(
      "id,business_place_id,vertical,tier,total_score,grade,languages_rendered,pdf_urls,generated_at,status,progress_stage,failed_reason,google_data,score_data",
    )
    .order("generated_at", { ascending: false })
    .limit(50)
    .returns<AuditRow[]>();

  const allRows = audits ?? [];
  const completed = allRows.filter((r) => r.status === "complete");

  // Compute per-business sequences so we can mark re-audits and trend.
  const auditsByPlace = new Map<string, AuditRow[]>();
  for (const row of [...completed].sort(
    (a, b) =>
      new Date(a.generated_at).getTime() - new Date(b.generated_at).getTime(),
  )) {
    const key = row.business_place_id ?? row.id;
    const arr = auditsByPlace.get(key) ?? [];
    arr.push(row);
    auditsByPlace.set(key, arr);
  }

  // Build display rows with computed flags.
  const displayRows = allRows.map((row) => {
    const key = row.business_place_id ?? row.id;
    const series = auditsByPlace.get(key) ?? [];
    const indexInSeries = series.findIndex((r) => r.id === row.id);
    const isReAudit = indexInSeries > 0;
    const prior = indexInSeries > 0 ? series[indexInSeries - 1] : null;
    const trendDelta =
      prior && row.total_score != null && prior.total_score != null
        ? row.total_score - prior.total_score
        : null;
    const isBilingual =
      row.languages_rendered.includes("en") &&
      row.languages_rendered.includes("zh");
    return { row, isReAudit, trendDelta, isBilingual };
  });

  // Apply business filter (by place_id).
  const filteredRows = businessFilter
    ? displayRows.filter((d) => d.row.business_place_id === businessFilter)
    : displayRows;

  // Filter chips: one per unique business + "All audits".
  const uniqueBusinesses = Array.from(
    new Map(
      completed
        .filter((r) => r.business_place_id)
        .map((r) => [
          r.business_place_id!,
          {
            place_id: r.business_place_id!,
            name: r.google_data?.business?.name ?? "(unknown)",
            count: 0,
          },
        ]),
    ).values(),
  );
  for (const b of uniqueBusinesses) {
    b.count = completed.filter(
      (r) => r.business_place_id === b.place_id,
    ).length;
  }

  // Service banner: lowest-scoring completed audit (only show if user has any
  // completed audits — and the lowest is below the "happy" threshold of 75).
  const lowestScoring = completed
    .filter((r) => r.total_score != null)
    .sort((a, b) => (a.total_score ?? 0) - (b.total_score ?? 0))[0];
  const serviceBannerAudit =
    lowestScoring && (lowestScoring.total_score ?? 100) < 75
      ? lowestScoring
      : null;

  // Insights bar: from the most recent completed audit's weakest component.
  const latestComplete = completed[0];
  const latestInsight = latestComplete
    ? insightFromWeakestComponent(
        latestComplete.score_data?.weakest_component,
        latestComplete.id,
      )
    : null;

  // Header counts.
  const totalCompleted = completed.length;
  const businessCount = uniqueBusinesses.length;
  const latestAgoDays = latestComplete
    ? daysAgo(new Date(latestComplete.generated_at))
    : null;

  const headerTitle =
    totalCompleted === 0
      ? "No audits yet."
      : totalCompleted === 1
        ? "One audit, ready to review."
        : `${numberWord(totalCompleted)} audits, ready to review.`;

  const resetDate = new Date(quota.quota_resets_at).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" },
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <AuditTopNav active="audit-list" />

      <section className="page-header">
        <div className="container">
          <div className="page-header-inner">
            <div>
              <div className="page-eyebrow">
                Your audits · Vol. I · {new Date().getFullYear()}
              </div>
              <h1 className="page-title">
                {totalCompleted === 0 ? (
                  "No audits yet."
                ) : (
                  <>
                    {totalCompleted === 1 ? "One audit, " : `${numberWord(totalCompleted)} audits, `}
                    <em>ready to review.</em>
                  </>
                )}
              </h1>
              {totalCompleted > 0 && (
                <p className="page-sub">
                  Across <strong>{businessCount} {businessCount === 1 ? "business" : "businesses"}</strong>
                  {latestAgoDays != null && (
                    <> · Latest audit {latestAgoDays === 0 ? "today" : `${latestAgoDays} ${latestAgoDays === 1 ? "day" : "days"} ago`}.</>
                  )}
                </p>
              )}
            </div>

            <div className="page-quota">
              <div className="quota-card">
                <div className="quota-block">
                  <div className="quota-label">This month</div>
                  <div className="quota-val">
                    {quota.monthly_cap - quota.monthly_remaining}
                    <em>/{quota.monthly_cap}</em>
                  </div>
                </div>
                <div className="quota-block">
                  <div className="quota-label">Lifetime</div>
                  <div className="quota-val">
                    {quota.lifetime_cap - quota.lifetime_remaining}
                    <em>/{quota.lifetime_cap}</em>
                  </div>
                </div>
              </div>
              <div className="quota-reset">Quota resets {resetDate}</div>
            </div>
          </div>

          {serviceBannerAudit && (
            <ServiceBanner
              businessName={
                serviceBannerAudit.google_data?.business?.name ?? "your business"
              }
              score={serviceBannerAudit.total_score ?? 0}
              grade={serviceBannerAudit.grade ?? "?"}
              auditId={serviceBannerAudit.id}
            />
          )}

          {latestInsight && (
            <div className="insights-bar">
              <p
                className="insights-bar-text"
                dangerouslySetInnerHTML={{ __html: latestInsight.text }}
              />
              <Link
                href={`/audit/${latestInsight.auditId}#action-01`}
                className="insights-bar-cta"
              >
                See action 1 →
              </Link>
            </div>
          )}

          {totalCompleted > 0 && (
            <div className="list-filters">
              <div className="list-filters-left">
                <span className="filter-label">Filter</span>
                <div className="filter-chips">
                  <Link
                    href="/audit/list"
                    className={`filter-chip${businessFilter === null ? " active" : ""}`}
                  >
                    All audits{" "}
                    <span className="filter-chip-count">{totalCompleted}</span>
                  </Link>
                  {uniqueBusinesses.map((b) => (
                    <Link
                      key={b.place_id}
                      href={`/audit/list?business=${encodeURIComponent(b.place_id)}`}
                      className={`filter-chip${businessFilter === b.place_id ? " active" : ""}`}
                    >
                      {b.name}{" "}
                      <span className="filter-chip-count">{b.count}</span>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="list-filters-right">
                <span className="list-sort">Sorted: Newest first</span>
              </div>
            </div>
          )}

          {totalCompleted === 0 ? (
            <EmptyState />
          ) : (
            <div className="audit-list">
              {filteredRows.map(({ row, isReAudit, trendDelta, isBilingual }) =>
                row.status === "generating" ? (
                  <GeneratingRow key={row.id} row={row} />
                ) : row.status === "failed" ? (
                  <FailedRow key={row.id} row={row} />
                ) : (
                  <CompletedRow
                    key={row.id}
                    row={row}
                    isReAudit={isReAudit}
                    trendDelta={trendDelta}
                    isBilingual={isBilingual}
                  />
                ),
              )}
            </div>
          )}

          <div className="bottom-actions">
            <div className="action-card">
              <div className="action-card-label">More to do</div>
              <h3 className="action-card-title">
                Audit <em>another business</em>
              </h3>
              <p className="action-card-body">
                You have {quota.monthly_remaining} audit
                {quota.monthly_remaining === 1 ? "" : "s"} remaining this month.
                Audit a competitor, a partner, or another location you own.
              </p>
              <Link href="/audit/new" className="action-card-link">
                Start new audit →
              </Link>
            </div>

            <div className="action-card">
              <div className="action-card-label">Read the research</div>
              <h3 className="action-card-title">
                The <em>methodology</em> behind the score
              </h3>
              <p className="action-card-body">
                15 cited studies on review economics, healthy velocity, and local
                search ranking. Every number in your audit traces back here.
              </p>
              <a
                href="https://www.baamreview.com/review-value.html"
                target="_blank"
                rel="noopener noreferrer"
                className="action-card-link"
              >
                View methodology →
              </a>
            </div>

            <div className="action-card">
              <div className="action-card-label">Get help</div>
              <h3 className="action-card-title">
                Have <em>questions</em> about your audit?
              </h3>
              <p className="action-card-body">
                Email us with any audit-specific questions. We typically respond
                within one business day.
              </p>
              <a
                href="mailto:support@baamreview.com"
                className="action-card-link"
              >
                Contact support →
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="footer-inner">
            <span className="footer-left">
              © {new Date().getFullYear()} BAAM Platform · New York
            </span>
            <div className="footer-right">
              <Link href="/account">Account</Link>
              <Link href="/legal/privacy">Privacy</Link>
              <Link href="/legal/terms">Terms</Link>
              <a href="mailto:support@baamreview.com">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

function CompletedRow({
  row,
  isReAudit,
  trendDelta,
  isBilingual,
}: {
  row: AuditRow;
  isReAudit: boolean;
  trendDelta: number | null;
  isBilingual: boolean;
}) {
  const business = row.google_data?.business;
  const vertical = VERTICAL_LABELS[row.vertical ?? ""] ?? row.vertical ?? "";
  const cityState = [business?.city, business?.state]
    .filter(Boolean)
    .join(", ");
  const score = row.total_score ?? 0;
  const grade = row.grade ?? "?";
  const gradeClass =
    score >= 75 ? "good" : score >= 60 ? "ok" : score >= 40 ? "warn" : "warn";

  const date = new Date(row.generated_at);
  const dateDisplay = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const ago = daysAgo(date);

  const enUrl = row.pdf_urls?.en;
  const zhUrl = row.pdf_urls?.zh;

  return (
    <div className="audit-row">
      <div className="audit-row-info">
        <div className="audit-row-name-row">
          <span className="audit-row-name">
            {business?.name ?? "(business name)"}
            {business?.name_secondary && (
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                {" "}
                · {business.name_secondary}
              </span>
            )}
          </span>
          {isBilingual && (
            <span className="audit-row-tag bilingual">EN + 中文</span>
          )}
          {isReAudit && <span className="audit-row-tag reaudit">Re-audit</span>}
        </div>
        <div className="audit-row-meta">
          {cityState}
          {vertical && ` · ${vertical}`}
          <span className="audit-row-meta-id">{shortId(row.id)}</span>
        </div>
      </div>

      <div className="audit-row-score-wrap">
        <span className="audit-row-score">{score}</span>
        <span className="audit-row-score-denom">/100</span>
      </div>

      <div className="audit-row-grade-block">
        <span className={`audit-row-grade ${gradeClass}`}>Grade {grade}</span>
        {trendDelta != null && trendDelta !== 0 && (
          <div
            className={`audit-row-grade-trend ${trendDelta > 0 ? "up" : "down"}`}
          >
            {trendDelta > 0 ? "↑" : "↓"} {Math.abs(trendDelta)} vs. last
          </div>
        )}
        {trendDelta === null && (
          <div className="audit-row-grade-trend">— baseline</div>
        )}
      </div>

      <div className="audit-row-date-block">
        <div className="audit-row-date">{dateDisplay}</div>
        <div className="audit-row-date-ago">
          {ago === 0 ? "today" : `${ago} ${ago === 1 ? "day" : "days"} ago`}
        </div>
      </div>

      <div className="audit-row-actions">
        <Link href={`/audit/${row.id}`} className="audit-row-action primary">
          View report
        </Link>
        {enUrl && (
          <a
            href={enUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="audit-row-action"
          >
            ↓ {isBilingual ? "EN PDF" : "PDF"}
          </a>
        )}
        {zhUrl && (
          <a
            href={zhUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="audit-row-action"
          >
            ↓ 中文 PDF
          </a>
        )}
      </div>
    </div>
  );
}

function GeneratingRow({ row }: { row: AuditRow }) {
  const seconds = Math.floor(
    (Date.now() - new Date(row.generated_at).getTime()) / 1000,
  );
  return (
    <div className="audit-row" style={{ opacity: 0.85 }}>
      <div className="audit-row-info">
        <div className="audit-row-name-row">
          <span className="audit-row-name">Generating your audit…</span>
          <span className="audit-row-tag">In progress</span>
        </div>
        <div className="audit-row-meta">
          Started {seconds}s ago
          <span className="audit-row-meta-id">{shortId(row.id)}</span>
        </div>
      </div>
      <div className="audit-row-actions">
        <Link
          href={`/audit/${row.id}/processing`}
          className="audit-row-action primary"
        >
          View progress
        </Link>
      </div>
    </div>
  );
}

function FailedRow({ row }: { row: AuditRow }) {
  return (
    <div className="audit-row" style={{ opacity: 0.7 }}>
      <div className="audit-row-info">
        <div className="audit-row-name-row">
          <span className="audit-row-name">Audit attempt failed</span>
          <span
            className="audit-row-tag"
            style={{ background: "rgba(184, 90, 56, 0.12)", color: "var(--warn)" }}
          >
            Failed
          </span>
        </div>
        <div className="audit-row-meta">
          {row.failed_reason ?? "Generation failed. Quota refunded."}
          <span className="audit-row-meta-id">{shortId(row.id)}</span>
        </div>
      </div>
      <div className="audit-row-actions">
        <Link href="/audit/new" className="audit-row-action primary">
          Retry
        </Link>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">§</div>
      <h2 className="empty-state-title">
        Ready for your <em>first audit</em>?
      </h2>
      <p className="empty-state-body">
        Audits take about 30–60 seconds to generate. The PDF lands here and
        stays there.
      </p>
      <Link
        href="/audit/new"
        style={{
          display: "inline-block",
          padding: "13px 24px",
          background: "var(--forest)",
          color: "var(--cream)",
          borderRadius: 999,
          fontFamily: "Onest, sans-serif",
          fontWeight: 500,
          fontSize: 14,
        }}
      >
        Start your first audit →
      </Link>
    </div>
  );
}

function insightFromWeakestComponent(
  weakest: string | undefined,
  auditId: string,
): { text: string; auditId: string } | null {
  const map: Record<string, string> = {
    velocity_30d:
      "<strong>FROM YOUR LATEST AUDIT</strong> &nbsp; Your <em>30-day velocity</em> is dropping fastest. Action 1 of the 12-month plan addresses this — velocity recovery typically lifts the score 8–12 points in 60 days.",
    review_volume:
      "<strong>FROM YOUR LATEST AUDIT</strong> &nbsp; Your <em>total review count</em> is below your vertical's median. Volume is the easiest lever to move — action 1 of the plan focuses here.",
    rating_quality:
      "<strong>FROM YOUR LATEST AUDIT</strong> &nbsp; Your <em>rating</em> is the drag on your score. The plan starts with response strategy and review-recovery tactics.",
    velocity_180d:
      "<strong>FROM YOUR LATEST AUDIT</strong> &nbsp; Your <em>6-month velocity</em> is the gap to close. Sustained collection over 90 days is the lever.",
    velocity_365d:
      "<strong>FROM YOUR LATEST AUDIT</strong> &nbsp; Your <em>12-month velocity</em> needs steady, sustained collection — the action plan turns this around.",
  };
  const text = weakest ? map[weakest] : null;
  return text ? { text, auditId } : null;
}

function shortId(id: string): string {
  return `BR-${id.slice(0, 4)}-${id.slice(4, 8)}`.toUpperCase();
}

function daysAgo(date: Date): number {
  const ms = Date.now() - date.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function numberWord(n: number): string {
  const words: Record<number, string> = {
    1: "One",
    2: "Two",
    3: "Three",
    4: "Four",
    5: "Five",
    6: "Six",
    7: "Seven",
    8: "Eight",
    9: "Nine",
    10: "Ten",
  };
  return words[n] ?? `${n}`;
}

