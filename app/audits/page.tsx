import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readMarketingDoc } from "@/lib/marketing/render";
import { canUserAudit } from "@/lib/audit/quotas";
import { AuditTopNav } from "@/components/audit/audit-top-nav";
import { ServiceBanner } from "./service-banner";

export const metadata = { title: "Your audits · BAAM Review" };
export const dynamic = "force-dynamic";

interface AuditListRow {
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
  tcm_clinic: "TCM CLINIC",
  dental: "DENTAL",
  legal_immigration: "IMMIGRATION LAW",
  restaurant: "RESTAURANT",
  real_estate: "REAL ESTATE",
  hotel: "HOTEL",
  auto: "AUTO",
  contractor: "CONTRACTOR",
  salon_spa: "SALON / SPA",
  cafe: "CAFÉ",
  apparel: "APPAREL",
  health_food: "HEALTH FOOD",
  insurance: "INSURANCE",
  general_smb: "LOCAL BUSINESS",
};

export default async function AuditsDashboardPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    redirect("/login?next=/audits");
  }

  const { css } = readMarketingDoc("audit-dashboard.html");
  const quota = await canUserAudit(authData.user.id);

  const { data: audits } = await supabase
    .from("audits")
    .select(
      "id,business_place_id,vertical,tier,total_score,grade,languages_rendered,pdf_urls,generated_at,status,progress_stage,failed_reason,google_data,score_data",
    )
    .order("generated_at", { ascending: false })
    .limit(50)
    .returns<AuditListRow[]>();

  const rows = audits ?? [];
  const completed = rows.filter((r) => r.status === "complete");
  const latestComplete = completed[0];

  const resetDate = new Date(quota.quota_resets_at).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" },
  );

  const headlineCount = rows.length === 0
    ? "No audits yet"
    : rows.length === 1
      ? "One audit, ready to review."
      : `${numberWord(rows.length)} audits, ready to review.`;

  const bannerHeadline = latestComplete && (latestComplete.total_score ?? 100) < 70
    ? `Your score is <em>${latestComplete.grade}</em>.<br><em>BAAM Review service</em> can take this from ${latestComplete.total_score} to 85+ in 90 days.`
    : `Your audit shows what to do.<br><em>BAAM Review service</em> does the work.`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <AuditTopNav active="audits" />

      <div className="dashboard">
        <div className="dashboard-inner">
          <div className="dashboard-header">
            <div className="dashboard-title-block">
              <div className="dashboard-eyebrow">Your reputation audits · Vol. I</div>
              <h1 className="dashboard-title">{headlineCount}</h1>
            </div>
            <div className="dashboard-actions">
              <div className="dashboard-quota">
                <div>
                  <span className="dashboard-quota-strong">
                    {quota.monthly_cap - quota.monthly_remaining} of {quota.monthly_cap}
                  </span>{" "}
                  monthly audits used
                </div>
                <div style={{ marginTop: 4 }}>resets {resetDate}</div>
              </div>
              {quota.allowed && (
                <Link href="/audit/new" className="new-audit-btn">
                  + New Audit
                </Link>
              )}
            </div>
          </div>

          {rows.length > 0 && <ServiceBanner headline={bannerHeadline} />}

          {rows.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="audit-list-header">
                <span>Audits · sorted newest first</span>
                <span>
                  {rows.length} {rows.length === 1 ? "audit" : "audits"} ·{" "}
                  {quota.lifetime_remaining} lifetime remaining
                </span>
              </div>

              <div className="audit-list">
                {rows.map((row) => (
                  <AuditCardRow key={row.id} row={row} />
                ))}
              </div>
            </>
          )}

          {latestComplete && <LatestInsightBanner audit={latestComplete} />}

          <div className="secondary-actions">
            <div className="secondary-action">
              <div className="secondary-action-eyebrow">More to do</div>
              <h3 className="secondary-action-title">
                Audit <em>another business</em>
              </h3>
              <p className="secondary-action-body">
                You have {quota.monthly_remaining} monthly audit
                {quota.monthly_remaining === 1 ? "" : "s"} and{" "}
                {quota.lifetime_remaining} lifetime remaining. Audit competitors,
                partner businesses, or other locations.
              </p>
              <Link href="/audit/new" className="secondary-action-link">
                Start new audit →
              </Link>
            </div>
            <div className="secondary-action">
              <div className="secondary-action-eyebrow">Read the research</div>
              <h3 className="secondary-action-title">
                The <em>methodology</em> behind the score
              </h3>
              <p className="secondary-action-body">
                15 cited studies on review economics, healthy velocity, and local
                search ranking. Every number in your audit traces here.
              </p>
              <a
                href="https://www.baamreview.com/review-value.html"
                target="_blank"
                rel="noopener noreferrer"
                className="secondary-action-link"
              >
                View methodology →
              </a>
            </div>
            <div className="secondary-action">
              <div className="secondary-action-eyebrow">Get help</div>
              <h3 className="secondary-action-title">
                Have <em>questions</em> about your audit?
              </h3>
              <p className="secondary-action-body">
                Email us with any audit-specific questions. We typically respond
                within one business day.
              </p>
              <a
                href="mailto:hello@baamreview.com"
                className="secondary-action-link"
              >
                Contact support →
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function AuditCardRow({ row }: { row: AuditListRow }) {
  if (row.status === "generating") {
    return <GeneratingCard row={row} />;
  }
  if (row.status === "failed") {
    return <FailedCard row={row} />;
  }
  return <CompletedCard row={row} />;
}

function CompletedCard({ row }: { row: AuditListRow }) {
  const business = row.google_data?.business;
  const isBilingual = row.languages_rendered.includes("en") && row.languages_rendered.includes("zh");
  const enUrl = row.pdf_urls?.en;
  const zhUrl = row.pdf_urls?.zh;

  return (
    <div className="audit-card">
      <div className="audit-card-main">
        <h3 className="audit-card-business">
          {business?.name ?? "(business name)"}
        </h3>
        {business?.name_secondary && (
          <div className="audit-card-business-zh">
            {business.name_secondary} · {VERTICAL_LABELS[row.vertical ?? ""]?.toLowerCase() ?? row.vertical}
          </div>
        )}
        <div className="audit-card-meta">
          <span className="audit-card-meta-strong">
            Audited {new Date(row.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <span className="audit-card-meta-divider"></span>
          <span>{[business?.city, business?.state].filter(Boolean).join(", ")}</span>
          <span className="audit-card-meta-divider"></span>
          <span>{shortId(row.id)}</span>
          <span className="audit-card-meta-divider"></span>
          <span className="audit-card-vertical-pill">
            {VERTICAL_LABELS[row.vertical ?? ""] ?? row.vertical}
          </span>
          {isBilingual && (
            <span className="audit-card-bilingual-pill">EN + 中文</span>
          )}
        </div>
      </div>
      <div className="audit-card-score-block">
        <div className="audit-card-score-num">{row.total_score}</div>
        <div className="audit-card-score-grade">Grade {row.grade}</div>
      </div>
      <div className="audit-card-actions">
        <Link href={`/audit/${row.id}`} className="audit-card-btn primary">
          View Audit
        </Link>
        {enUrl && (
          <a href={enUrl} target="_blank" rel="noopener noreferrer" className="audit-card-btn">
            Download {isBilingual ? "EN PDF" : "PDF"}
          </a>
        )}
        {zhUrl && (
          <a href={zhUrl} target="_blank" rel="noopener noreferrer" className="audit-card-btn">
            Download 中文 PDF
          </a>
        )}
      </div>
    </div>
  );
}

const STAGE_LABELS = [
  "Locating your business",
  "Locating your business",
  "Finding competitors",
  "Calculating score",
  "Projecting trajectory",
  "Generating PDF",
];

function GeneratingCard({ row }: { row: AuditListRow }) {
  const stage = row.progress_stage;
  const pct = Math.max(8, Math.min(100, (stage / 5) * 100));
  const stageLabel = STAGE_LABELS[stage] ?? "Working…";
  const seconds = Math.floor(
    (Date.now() - new Date(row.generated_at).getTime()) / 1000,
  );

  return (
    <div className="audit-card in-progress">
      <div className="audit-card-main">
        <h3 className="audit-card-business">Generating your audit…</h3>
        <div className="audit-card-meta">
          <span className="audit-card-meta-strong">
            Started {seconds}s ago
          </span>
          <span className="audit-card-meta-divider"></span>
          <span>{shortId(row.id)}</span>
        </div>
      </div>
      <div className="audit-progress-block">
        <div className="audit-progress-bar">
          <div
            className="audit-progress-bar-fill"
            style={{ width: `${pct}%` }}
          ></div>
        </div>
        <div className="audit-progress-info">
          <div className="audit-progress-stage">{stageLabel}</div>
          <div className="audit-progress-eta">
            step {Math.max(1, stage)} of 5
          </div>
        </div>
      </div>
      <div className="audit-card-actions">
        <Link
          href={`/audit/${row.id}/processing`}
          className="audit-card-btn primary"
        >
          View progress
        </Link>
      </div>
    </div>
  );
}

function FailedCard({ row }: { row: AuditListRow }) {
  return (
    <div className="audit-card failed">
      <div className="audit-card-main">
        <h3 className="audit-card-business">Audit attempt failed</h3>
        <div className="audit-card-meta">
          <span className="audit-card-meta-strong">
            Attempted{" "}
            {new Date(row.generated_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="audit-card-meta-divider"></span>
          <span>{shortId(row.id)}</span>
        </div>
      </div>
      <div className="audit-fail-info">
        <div className="audit-fail-headline">⚠ Generation failed</div>
        <div className="audit-fail-body">
          {row.failed_reason
            ? `"${row.failed_reason}"`
            : "Generation failed. Quota refunded."}
        </div>
        <div className="audit-fail-actions">
          <Link href="/audit/new" className="audit-card-btn primary">
            Retry
          </Link>
          <a
            href="mailto:hello@baamreview.com"
            className="audit-card-btn"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}

function LatestInsightBanner({ audit }: { audit: AuditListRow }) {
  const weakest = audit.score_data?.weakest_component;
  if (!weakest) return null;

  const insightMap: Record<string, string> = {
    velocity_30d:
      "Your <em>30-day velocity</em> is dropping fastest. The first action of your 12-month plan would address this.",
    review_volume:
      "Your <em>total review count</em> is below the vertical median. Volume is your weakest area — and the easiest to move.",
    rating_quality:
      "Your <em>rating</em> is the drag on your score. The 12-month action plan starts with response strategy to lift it.",
    velocity_180d:
      "Your <em>6-month velocity</em> needs sustained effort to close the gap with leaders in your market.",
    velocity_365d:
      "Your <em>12-month velocity</em> needs steady collection — the action plan turns this around.",
  };

  const text = insightMap[weakest] ?? null;
  if (!text) return null;

  return (
    <div className="insight-banner">
      <div>
        <div className="insight-banner-label">From your latest audit</div>
        <p
          className="insight-banner-text"
          dangerouslySetInnerHTML={{ __html: text }}
        />
      </div>
      <a
        href="https://baamreview.com"
        target="_blank"
        rel="noopener noreferrer"
        className="insight-banner-cta"
      >
        Get help executing →
      </a>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-mark">§</div>
      <h2 className="empty-state-headline">
        Ready for your <em>first audit</em>?
      </h2>
      <p className="empty-state-body">
        Audits take about 30–60 seconds to generate. The PDF lands in your
        dashboard and stays there.
      </p>
      <Link href="/audit/new" className="empty-state-cta">
        Start your first audit
      </Link>
    </div>
  );
}

function shortId(id: string): string {
  return `BR-${id.slice(0, 4)}-${id.slice(4, 8)}`.toUpperCase();
}

function numberWord(n: number): string {
  const words: Record<number, string> = {
    1: "One",
    2: "Two",
    3: "Three",
    4: "Four",
    5: "Five",
  };
  return words[n] ?? `${n}`;
}
