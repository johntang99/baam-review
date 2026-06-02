import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { readMarketingDoc } from "@/lib/marketing/render";
import { canUserAudit } from "@/lib/audit/quotas";
import { AuditTopNav } from "@/components/audit/audit-top-nav";

export const metadata: Metadata = {
  title: "BAAM Review Audit — Free reputation report for local businesses",
  description:
    "A 7-page reputation audit for your local business. Score, projection, competitor comparison, 12-month action plan. Free, no credit card.",
};

export const dynamic = "force-dynamic";

interface HubAudit {
  id: string;
  total_score: number | null;
  grade: string | null;
  generated_at: string;
  vertical: string | null;
  google_data: {
    business?: {
      name?: string;
      name_secondary?: string;
      city?: string;
      state?: string;
    };
    language?: { is_chinese_business?: boolean };
  } | null;
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

export default async function AuditPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  // Decide state: B = signed-in with at least one completed audit; A otherwise.
  if (user) {
    const { data: audits } = await supabase
      .from("audits")
      .select("id,total_score,grade,generated_at,vertical,google_data")
      .eq("status", "complete")
      .order("generated_at", { ascending: false })
      .limit(3)
      .returns<HubAudit[]>();

    if (audits && audits.length > 0) {
      const quota = await canUserAudit(user.id);
      const totalCompleted = audits.length;
      const businessCount = new Set(
        audits.map((a) => a.google_data?.business?.name ?? a.id),
      ).size;
      const latestAgo = daysAgo(new Date(audits[0].generated_at));
      const lowestScoring = [...audits]
        .filter((a) => a.total_score != null)
        .sort((a, b) => (a.total_score ?? 0) - (b.total_score ?? 0))[0];

      return (
        <StateBHub
          userName={firstNameOrEmail(user.email ?? "")}
          userEmail={user.email ?? ""}
          audits={audits}
          quota={quota}
          totalCompleted={totalCompleted}
          businessCount={businessCount}
          latestAgoDays={latestAgo}
          lowestScoring={lowestScoring ?? null}
        />
      );
    }
  }

  return <StateAMarketing loggedIn={!!user} />;
}

// =============================================================================
// STATE A — cold visitor OR signed-in user with no audits yet.
// Renders the existing audit-marketing.html. For signed-in users we rewrite
// the hardcoded `/signup?next=/audit/new` CTAs to point straight at
// `/audit/new` — they're already authenticated, no signup detour needed.
// =============================================================================
function StateAMarketing({ loggedIn }: { loggedIn: boolean }) {
  const { css, bodyHtml } = readMarketingDoc("audit-marketing.html");
  const finalHtml = loggedIn
    ? bodyHtml.replaceAll("/signup?next=/audit/new", "/audit/new")
    : bodyHtml;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <AuditTopNav />
      <div
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: finalHtml }}
      />
    </>
  );
}

// =============================================================================
// STATE B — signed-in with audits (new hub design from audit-page.html)
// =============================================================================
interface QuotaSummary {
  monthly_cap: number;
  monthly_remaining: number;
  lifetime_cap: number;
  lifetime_remaining: number;
}

function StateBHub({
  userName,
  userEmail,
  audits,
  quota,
  totalCompleted,
  businessCount,
  latestAgoDays,
  lowestScoring,
}: {
  userName: string;
  userEmail: string;
  audits: HubAudit[];
  quota: QuotaSummary;
  totalCompleted: number;
  businessCount: number;
  latestAgoDays: number;
  lowestScoring: HubAudit | null;
}) {
  const { css } = readMarketingDoc("audit-page.html");

  // Service cross-link headline: contextualize to lowest-scoring audit.
  const serviceCardEnabled =
    lowestScoring && (lowestScoring.total_score ?? 100) < 75;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <AuditTopNav />

      <section className="hero state-b">
        <div className="container">
          <div className="hub-card">
            <div className="hub-card-header">
              <div>
                <div className="hub-card-header-tag">Your audit hub</div>
                <h1 className="hub-card-greeting">
                  Welcome back, <em>{userName}.</em>
                </h1>
                <div className="hub-card-summary">
                  {totalCompleted}{" "}
                  {totalCompleted === 1 ? "audit" : "audits"} across{" "}
                  {businessCount}{" "}
                  {businessCount === 1 ? "business" : "businesses"}
                  {latestAgoDays != null && (
                    <>
                      {" · Latest audit "}
                      {latestAgoDays === 0
                        ? "today"
                        : `${latestAgoDays} ${
                            latestAgoDays === 1 ? "day" : "days"
                          } ago`}
                    </>
                  )}
                </div>
              </div>
              <div className="hub-card-stats">
                <div className="hub-card-stat-block">
                  <div className="hub-card-stat-label">This month</div>
                  <div className="hub-card-stat-val">
                    {quota.monthly_cap - quota.monthly_remaining} /{" "}
                    {quota.monthly_cap}
                  </div>
                </div>
                <div className="hub-card-stat-block">
                  <div className="hub-card-stat-label">Lifetime</div>
                  <div className="hub-card-stat-val">
                    {quota.lifetime_cap - quota.lifetime_remaining} /{" "}
                    {quota.lifetime_cap}
                  </div>
                </div>
              </div>
            </div>

            <div className="hub-card-body">
              <div className="hub-section-label">
                Recent audits · click to view
              </div>
              <div className="hub-audits-list">
                {audits.map((a) => {
                  const business = a.google_data?.business;
                  const vertical =
                    VERTICAL_LABELS[a.vertical ?? ""] ?? a.vertical ?? "";
                  const meta = [
                    [business?.city, business?.state].filter(Boolean).join(", "),
                    vertical,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const score = a.total_score ?? 0;
                  const grade = a.grade ?? "?";
                  const gradeClass =
                    score >= 75
                      ? "good"
                      : score >= 60
                        ? "ok"
                        : "warn";
                  const initial = (business?.name?.[0] ?? "B").toUpperCase();
                  const date = new Date(a.generated_at).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" },
                  );

                  return (
                    <Link
                      key={a.id}
                      href={`/audit/${a.id}`}
                      className="hub-audit-row"
                    >
                      <div className="hub-audit-row-mark">{initial}</div>
                      <div className="hub-audit-row-info">
                        <div className="hub-audit-row-name">
                          {business?.name ?? "(business)"}
                        </div>
                        <div className="hub-audit-row-meta">{meta}</div>
                      </div>
                      <div className="hub-audit-row-score-wrap">
                        <span className="hub-audit-row-score">{score}</span>
                        <span className="hub-audit-row-score-denom">/100</span>
                      </div>
                      <span className={`hub-audit-row-grade ${gradeClass}`}>
                        Grade {grade}
                      </span>
                      <span className="hub-audit-row-date">{date}</span>
                    </Link>
                  );
                })}
              </div>

              <div className="hub-actions">
                <Link href="/audit/new" className="btn btn-primary btn-large">
                  Run a new audit →
                </Link>
                <Link
                  href="/audit/list"
                  className="btn btn-outline btn-large"
                >
                  View all in dashboard →
                </Link>
              </div>
              <p className="hub-quota-note">
                <strong>QUOTA</strong> &nbsp; You have{" "}
                {quota.monthly_remaining} audit
                {quota.monthly_remaining === 1 ? "" : "s"} remaining this month
                and {quota.lifetime_remaining} remaining lifetime.
              </p>

              {serviceCardEnabled && lowestScoring && (
                <div className="hub-service-card">
                  <div className="hub-service-card-content">
                    <div className="hub-service-card-tag">
                      → Ready to act on{" "}
                      {lowestScoring.google_data?.business?.name ??
                        "your audit"}
                      's plan?
                    </div>
                    <h3 className="hub-service-card-title">
                      Most clients with Grade {lowestScoring.grade} reach{" "}
                      <em>the next grade up</em> within 90 days of service.
                    </h3>
                    <p className="hub-service-card-body">
                      BAAM Review Service runs your review collection for you.
                      Start a 30-day free trial — uses this same account, no
                      re-signup. Two tiers: $99 or $399/mo.
                    </p>
                  </div>
                  <Link
                    href={`/audit/service?audit=${encodeURIComponent(lowestScoring.id)}`}
                    className="hub-service-card-cta"
                  >
                    Choose a plan →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="footer-grid">
            <div>
              <Link href="/audit" className="logo">
                <span className="logo-mark">B</span>
                BAAM Review Audit
              </Link>
              <p className="footer-tagline">
                Your reputation, audited. Then run for you. From BAAM Platform ·
                New York.
              </p>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Product</div>
              <ul>
                <li>
                  <Link href="/audit/new">New audit</Link>
                </li>
                <li>
                  <Link href="/audit/list">My audits</Link>
                </li>
                <li>
                  <Link href="/audit/service">Service</Link>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Account</div>
              <ul>
                <li>{userEmail}</li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Legal</div>
              <ul>
                <li>
                  <Link href="/legal/privacy">Privacy</Link>
                </li>
                <li>
                  <Link href="/legal/terms">Terms</Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} BAAM Platform · New York</span>
            <span>Vol. I · No. 001</span>
          </div>
        </div>
      </footer>
    </>
  );
}

function daysAgo(date: Date): number {
  const ms = Date.now() - date.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function firstNameOrEmail(email: string): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}
