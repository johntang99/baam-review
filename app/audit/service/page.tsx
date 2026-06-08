import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { readMarketingDoc } from "@/lib/marketing/render";
import { AuditTopNav } from "@/components/audit/audit-top-nav";
import { HeroRotation } from "@/components/service/hero-rotation";
import { JsonLd } from "@/components/seo/JsonLd";
import { serviceSchema } from "@/lib/seo/schemas";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://baamreview.com";
/**
 * NOTE: this page used to fire Stripe Checkout directly via StartTrialButton.
 * It now routes plan-CTA clicks through /signup?plan=… for everyone:
 *   • logged-out → renders the signup form, persists preferred_plan
 *   • logged-in  → /signup applies the plan and redirects to /app/billing
 *                  where the onboarding bar (1-Connect GBP, 2-Set up billing,
 *                  3-Start Review Request) drives the rest of the journey.
 * Single, unified flow whether the user is coming from the audit, the
 * marketing home, or anywhere else.
 */

export const metadata: Metadata = {
  title: "BAAM Review · Service — We run your review collection",
  description:
    "Two tiers: $99 self-serve or $399 full service. 30-day free trial. We send the requests, draft the responses, and report monthly.",
  alternates: { canonical: `${BASE_URL}/audit/service` },
};

export const dynamic = "force-dynamic";

interface PersonAudit {
  id: string;
  total_score: number | null;
  grade: string | null;
  generated_at: string;
  vertical: string | null;
  score_data: {
    components?: Record<string, { raw_score: number; weight: number }>;
  } | null;
  projection_data: {
    revenue_impact?: { six_month_loss_usd?: number };
  } | null;
  google_data: {
    business?: { name?: string; city?: string; state?: string };
  } | null;
}

type Plan = "self" | "full";

export default async function ServicePage(props: {
  searchParams: Promise<{ plan?: string; audit?: string }>;
}) {
  const params = await props.searchParams;
  const requestedPlan: Plan | null =
    params.plan === "self" || params.plan === "full" ? params.plan : null;
  const requestedAuditId = params.audit ?? null;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (user) {
    let audit: PersonAudit | null = null;
    if (requestedAuditId) {
      const { data } = await supabase
        .from("audits")
        .select(
          "id,total_score,grade,generated_at,vertical,score_data,projection_data,google_data",
        )
        .eq("id", requestedAuditId)
        .eq("status", "complete")
        .maybeSingle<PersonAudit>();
      audit = data ?? null;
    }
    if (!audit) {
      // Default to the most recent completed audit so projections match what
      // the user was just looking at on /audit/<id>. Users navigate here
      // after viewing an audit, not after thinking "which one is worst?"
      const { data } = await supabase
        .from("audits")
        .select(
          "id,total_score,grade,generated_at,vertical,score_data,projection_data,google_data",
        )
        .eq("status", "complete")
        .order("generated_at", { ascending: false })
        .limit(1)
        .returns<PersonAudit[]>();
      audit = data?.[0] ?? null;
    }

    if (audit) {
      return (
        <>
          <JsonLd data={serviceSchema()} />
          <StateBPersonalized
            audit={audit}
            requestedPlan={requestedPlan}
          />
        </>
      );
    }
  }

  return (
    <>
      <JsonLd data={serviceSchema()} />
      <StateAMarketing requestedPlan={requestedPlan} />
    </>
  );
}

// =============================================================================
// SHARED — Nav, Footer, Pricing tiers content
// =============================================================================

function ServiceFooter() {
  return (
    <footer
      style={{
        padding: "40px 0",
        background: "var(--ink)",
        color: "var(--cream)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        letterSpacing: "0.06em",
      }}
    >
      <div className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <span style={{ color: "rgba(250, 247, 242, 0.5)" }}>
            © {new Date().getFullYear()} BAAM Platform · New York
          </span>
          <div style={{ display: "flex", gap: 20 }}>
            <Link
              href="/legal/privacy"
              style={{ color: "rgba(250, 247, 242, 0.6)" }}
            >
              Privacy
            </Link>
            <Link
              href="/legal/terms"
              style={{ color: "rgba(250, 247, 242, 0.6)" }}
            >
              Terms
            </Link>
            <a
              href="mailto:support@baamplatform.com"
              style={{ color: "rgba(250, 247, 242, 0.6)" }}
            >
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Logged-out signup URL for a tier CTA. `?next=` preserves the audit
 *  context so when the user lands back on this page after auth, the
 *  StartTrialButton (rendered for logged-in users) is ready to click and
 *  POSTs to the real Stripe Checkout endpoint. */
function signupHrefForTier(plan: Plan, auditId?: string): string {
  const target = auditId
    ? `/audit/service?plan=${plan}&audit=${encodeURIComponent(auditId)}`
    : `/audit/service?plan=${plan}`;
  return `/signup?next=${encodeURIComponent(target)}`;
}

function PlanInterestBanner({ plan }: { plan: Plan }) {
  const planLabel = plan === "full" ? "Full Service ($399/mo)" : "Self-Serve ($99/mo)";
  return (
    <div
      style={{
        background: "var(--ink)",
        color: "var(--cream)",
        padding: "16px 24px",
        borderRadius: 12,
        margin: "0 auto 32px",
        maxWidth: 920,
        borderLeft: "3px solid var(--gold)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--gold)",
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          INTEREST CAPTURED
        </div>
        <div
          style={{
            fontFamily: "'Newsreader', serif",
            fontSize: 15,
            color: "var(--cream)",
            lineHeight: 1.5,
          }}
        >
          You've picked <strong>{planLabel}</strong>. The service is in private
          beta — email us and we'll schedule your onboarding within 48 hours.
        </div>
      </div>
      <a
        href={`mailto:support@baamplatform.com?subject=Service interest: ${planLabel}`}
        style={{
          background: "var(--gold)",
          color: "var(--ink)",
          padding: "10px 18px",
          borderRadius: 999,
          fontFamily: "'Onest', sans-serif",
          fontWeight: 600,
          fontSize: 13,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        Email us →
      </a>
    </div>
  );
}

// =============================================================================
// STATE A — Cold visitor (or no audit yet)
// =============================================================================

function StateAMarketing({ requestedPlan }: { requestedPlan: Plan | null }) {
  const { css } = readMarketingDoc("audit-service.html");
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <AuditTopNav active="audit-service" />

      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <div className="hero-eyebrow">
              BAAM Review · Service
              <span className="hero-eyebrow-dot"></span>
            </div>
            <h1>
              We run your review collection.
              <br />
              <em>You run your business.</em>
            </h1>
            <p className="hero-sub">
              Weekly customer outreach. Daily monitoring. Monthly reporting.{" "}
              <strong>AI-drafted responses in EN, 中文, Español.</strong> Two
              tiers — both start with a 30-day free trial.
            </p>
            <div className="hero-ctas">
              <Link
                href={signupHrefForTier("full")}
                className="btn btn-primary btn-large"
              >
                Start free trial →
              </Link>
              <Link href="#tiers" className="btn btn-outline btn-large">
                See the tiers →
              </Link>
              <Link href="/audit/new" className="btn btn-ghost btn-large">
                Take audit first →
              </Link>
            </div>
            <div className="hero-trust">
              <span>30-day trial · No charge</span>
              <span className="hero-trust-line"></span>
              <span>Cancel anytime</span>
              <span className="hero-trust-line"></span>
              <span>One account for audit + service</span>
            </div>
          </div>
        </div>
      </section>

      {requestedPlan && (
        <div className="container">
          <PlanInterestBanner plan={requestedPlan} />
        </div>
      )}

      <RhythmSection />
      <TiersSection
        loggedIn={false}
        recommended="full"
      />
      <PromiseSection />
      <AuditOffRamp />
      <FAQSection />

      <section className="final-cta">
        <div className="container">
          <div className="final-cta-inner">
            <div className="final-cta-mark">§</div>
            <h2 className="final-cta-title">
              Your reviews <em>can be</em> someone else's job.
            </h2>
            <p className="final-cta-sub">
              Start your 30-day free trial. Or take the audit first to see
              exactly what we'd be doing for your business.
            </p>
            <div className="final-cta-buttons">
              <Link
                href={signupHrefForTier("full")}
                className="btn btn-gold btn-xl"
              >
                Start free trial →
              </Link>
              <Link
                href="/audit/new"
                className="btn btn-outline btn-xl"
              >
                Take free audit first →
              </Link>
            </div>
            <div className="final-cta-footnote">
              30-day trial · Card not required during beta · Cancel anytime
            </div>
          </div>
        </div>
      </section>

      <ServiceFooter />
    </>
  );
}

// =============================================================================
// STATE B — Signed-in with audit (personalized)
// =============================================================================

function StateBPersonalized({
  audit,
  requestedPlan,
}: {
  audit: PersonAudit;
  requestedPlan: Plan | null;
}) {
  const { css } = readMarketingDoc("audit-service.html");

  const businessName = audit.google_data?.business?.name ?? "your business";
  const score = audit.total_score ?? 0;
  const grade = (audit.grade ?? "C") as "A" | "B" | "C" | "D" | "F";
  const auditAgoDays = daysAgo(new Date(audit.generated_at));

  // Use the same projection model as Phase 1's data-mapper.
  const projection = projectScore(score, grade);
  const recommendedTier: Plan = score < 65 ? "full" : "self";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <AuditTopNav active="audit-service" />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .hero.state-b .hero-inner { max-width: 1180px; }
            @media (min-width: 960px) {
              .hero.state-b .hero-inner {
                display: grid;
                grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
                gap: 56px;
                align-items: center;
              }
              .hero.state-b .hero-inner > .hero-rotation { justify-self: end; }
            }
          `,
        }}
      />

      <section className="hero state-b">
        <div className="container">
          <div className="hero-inner">
            <div>
              <div className="hero-business-tag">
                <span className="hero-business-tag-mark">
                  {(businessName[0] ?? "B").toUpperCase()}
                </span>
                {businessName}
                <span className="hero-business-tag-divider">·</span>
                <span className="hero-business-tag-detail">
                  Audited{" "}
                  {auditAgoDays === 0
                    ? "today"
                    : `${auditAgoDays} ${auditAgoDays === 1 ? "day" : "days"} ago`}
                </span>
              </div>

              <h1>
                {businessName} scored{" "}
                <span className="score-inline">
                  {score}
                  <span className="score-inline-denom">/100</span>
                </span>
                .<br />
                <em>Here's how to climb.</em>
              </h1>

              <div className="hero-personalized-context">
                <span className="hero-personalized-context-label">
                  What service typically delivers for businesses at your grade
                </span>
                Most clients starting at <strong>Grade {grade}</strong> reach{" "}
                <strong>the next grade up</strong> within{" "}
                <strong>90–120 days</strong> of Full Service. Below: your audit
                summary, projected outcome range, and the rhythm we'd use.
              </div>

              <div className="hero-ctas">
                <Link
                  href={`/signup?plan=${recommendedTier}`}
                  className="btn btn-primary btn-large"
                >
                  Start free trial →
                </Link>
                <Link
                  href={`/audit/${audit.id}`}
                  className="btn btn-outline btn-large"
                >
                  View full audit →
                </Link>
              </div>
              <div className="hero-trust">
                <span>30-day trial · No charge during beta</span>
                <span className="hero-trust-line"></span>
                <span>Cancel anytime</span>
                <span className="hero-trust-line"></span>
                <span>Uses your existing account</span>
              </div>
            </div>

            <HeroRotation />
          </div>
        </div>
      </section>

      {requestedPlan && (
        <div className="container" style={{ marginTop: 24 }}>
          <PlanInterestBanner plan={requestedPlan} />
        </div>
      )}

      <AuditSummaryCard audit={audit} businessName={businessName} />

      <ProjectedOutcomeSection
        projection={projection}
        businessName={businessName}
      />

      <RhythmSection />

      <TiersSection
        loggedIn
        recommended={recommendedTier}
        auditId={audit.id}
        projection={projection}
      />

      <PersonalizedPromiseSection audit={audit} />

      <section className="final-cta">
        <div className="container">
          <div className="final-cta-inner">
            <div className="final-cta-mark">§</div>
            <h2 className="final-cta-title">
              {businessName}, ready to <em>climb</em>?
            </h2>
            <p className="final-cta-sub">
              Your audit shows where you stand. The trial starts moving you up.
              Your account is already set up — one click activates everything.
            </p>
            <div className="final-cta-buttons">
              <Link href="/signup?plan=full" className="btn btn-gold btn-xl">
                Start Full Service trial →
              </Link>
              <Link href="/signup?plan=self" className="btn btn-outline btn-xl">
                Start Self-Serve trial →
              </Link>
            </div>
            <div className="final-cta-footnote">
              30-day trial · No charge · Cancel anytime · Activates your
              existing account
            </div>
          </div>
        </div>
      </section>

      <ServiceFooter />
    </>
  );
}

// =============================================================================
// SHARED SECTIONS
// =============================================================================

function RhythmSection() {
  return (
    <section className="rhythm-section">
      <div className="container">
        <div className="rhythm-header">
          <div className="section-eyebrow">§ 01 · What we actually do</div>
          <h2 className="section-title">
            Three phases. <em>A simple rhythm.</em> No mystery.
          </h2>
          <p className="section-sub">
            Tagged <strong>We</strong> means we do it.{" "}
            <strong>You</strong> means you do it. Most tiers, most of the work
            is ours.
          </p>
        </div>
        <div className="rhythm-grid">
          <RhythmCard
            tag="Phase 1 · Week 1"
            title={
              <>
                Setup &amp; <em>baseline</em>
              </>
            }
            sub="We connect, set up, draft templates. You hand us the keys."
            items={[
              { role: "we", text: "Connect your Google Business Profile" },
              { role: "we", text: "Audit your last 90 days of reviews" },
              { role: "we", text: "Draft response templates in your voice" },
              { role: "you", text: "Send us your customer list" },
              { role: "you", text: "Approve the response templates" },
            ]}
          />
          <RhythmCard
            tag="Phase 2 · Weeks 2–4"
            title={
              <>
                First batch <em>goes out</em>
              </>
            }
            sub="Review requests reach customers. Daily monitoring begins. First responses go live."
            items={[
              { role: "we", text: "Send review requests, 60-second flow" },
              { role: "we", text: "Monitor reviews daily" },
              { role: "we", text: "Draft responses for approval (Self-Serve)" },
              { role: "we", text: "Auto-publish in your voice (Full Service)" },
              { role: "we", text: "Catch negative feedback before public" },
            ]}
          />
          <RhythmCard
            tag="Phase 3 · Monthly"
            title={
              <>
                Reporting &amp; <em>iteration</em>
              </>
            }
            sub="Every month, a report on what changed, what worked, where you rank."
            items={[
              { role: "we", text: "Send monthly Review Revenue report" },
              { role: "we", text: "Track ranking changes vs. competitors" },
              { role: "we", text: "Refine response style" },
              { role: "we", text: "Schedule quarterly partner call" },
              { role: "you", text: "Send updated customer list weekly" },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function RhythmCard({
  tag,
  title,
  sub,
  items,
}: {
  tag: string;
  title: React.ReactNode;
  sub: string;
  items: Array<{ role: "we" | "you"; text: string }>;
}) {
  return (
    <div className="rhythm-card">
      <div className="rhythm-card-tag">{tag}</div>
      <h3 className="rhythm-card-title">{title}</h3>
      <p className="rhythm-card-sub">{sub}</p>
      <ul className="rhythm-list">
        {items.map((it, i) => (
          <li key={i} className={it.role}>
            <span className="role">{it.role === "we" ? "We" : "You"}</span>
            {it.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TiersSection({
  loggedIn,
  recommended,
  auditId,
  projection,
}: {
  loggedIn: boolean;
  recommended: Plan;
  auditId?: string;
  projection?: ScoreProjection;
}) {
  return (
    <section className="tiers-section" id="tiers">
      <div className="container">
        <div className="tiers-header">
          <div className="section-eyebrow">§ 02 · Two ways to start</div>
          <h2 className="section-title">
            $99 or $399. <em>You decide who does the work.</em>
          </h2>
          <p className="section-sub">
            Self-Serve gives you the platform; you drive the workflow. Full
            Service hands the entire workflow to our team. Both include the
            30-day free trial.
          </p>
        </div>
        <div className="tiers-grid">
          <TierCard
            plan="self"
            isRecommended={recommended === "self"}
            loggedIn={loggedIn}
            auditId={auditId}
            projection={projection}
          />
          <TierCard
            plan="full"
            isRecommended={recommended === "full"}
            loggedIn={loggedIn}
            auditId={auditId}
            projection={projection}
          />
        </div>
      </div>
    </section>
  );
}

function TierCard({
  plan,
  isRecommended,
  loggedIn,
  auditId,
  projection,
}: {
  plan: Plan;
  isRecommended: boolean;
  loggedIn: boolean;
  auditId?: string;
  projection?: ScoreProjection;
}) {
  const isSelfServe = plan === "self";
  const featuredClass = isSelfServe ? "" : "featured";
  const recommendedTag = isRecommended ? "Recommended for your score range" : null;

  const personalized = projection != null;
  const projectionLine = !personalized ? null : isSelfServe ? (
    <>90-day score range <strong>{projection.d90.low}–{projection.d90.high}</strong> · velocity recovery 3–5/month</>
  ) : (
    <>90-day score range <strong>{projection.d90.low}–{projection.d90.high}</strong> · velocity recovery 5–8/month · <strong>5× Return Standard</strong></>
  );

  return (
    <div className={`tier-card ${featuredClass}`.trim()}>
      {recommendedTag && (
        <span className="tier-personalized-tag gold">{recommendedTag}</span>
      )}
      <div className="tier-path">
        Path {isSelfServe ? "A · Self-serve" : "B · Full Service"}
      </div>
      <h3 className="tier-name">
        {isSelfServe ? (
          <>
            Run it <em>yourself</em>
          </>
        ) : (
          <>
            We run it <em>for you</em>
          </>
        )}
      </h3>
      <p className="tier-tagline">
        {isSelfServe
          ? "You drive the workflow with our platform, AI drafts, and bilingual templates."
          : "Send us your customer list weekly. We handle every review request, every response, every report."}
      </p>
      <div className="tier-price-row">
        <span className="tier-price">{isSelfServe ? "$99" : "$399"}</span>
        <span className="tier-price-period">/ month</span>
      </div>
      <div className="tier-annual">
        or <strong>{isSelfServe ? "$990" : "$3,990"}/year</strong> — 2 months
        free
      </div>
      <div className="tier-trial-line">
        30-day free trial · cancel anytime
      </div>

      {personalized && projectionLine && (
        <div
          style={{
            background: "var(--cream-deep)",
            borderRadius: 10,
            padding: "12px 16px",
            margin: "12px 0 18px",
            fontFamily: "'Newsreader', serif",
            fontSize: 14,
            fontStyle: "italic",
            color: "var(--text)",
            lineHeight: 1.5,
          }}
        >
          {projectionLine}
        </div>
      )}

      <div className="tier-features-label">What's included</div>
      <ul className="tier-features">
        {(isSelfServe
          ? [
              "Single location · unlimited review requests",
              "AI drafting in EN / 中文 / Español",
              "Lists, batch sends, private feedback path",
              "Monthly Review Revenue report",
              "Each additional location: same $99/mo",
            ]
          : [
              "Everything in Self-Serve, plus:",
              "We send all review requests, weekly",
              "We reply to every review in your voice",
              "We catch private feedback before it's public",
              "Quarterly partner call with account manager",
            ]
        ).map((feature, i) => (
          <li key={i}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>
      <Link href={`/signup?plan=${plan}`} className="tier-cta">
        Start {isSelfServe ? "Self-Serve" : "Full Service"} trial →
      </Link>
      <div className="tier-cta-sub">
        {loggedIn
          ? "Uses your existing account · no re-signup"
          : "No charge today · 30-day trial · cancel anytime"}
      </div>
    </div>
  );
}

function PromiseSection() {
  return (
    <section className="promise-section">
      <div className="container">
        <div className="promise-inner">
          <div className="promise-eyebrow">§ 03 · Our 5× Return Standard</div>
          <h2 className="promise-title">
            For every <em>$1</em> you spend, we aim to generate{" "}
            <em>$5+ in tracked Review Revenue</em> over 12 months.
          </h2>
          <p className="promise-sub">
            Measured by us, audited by you, against industry benchmarks for
            your vertical. Available on Full Service plans.
          </p>
          <div className="promise-stats">
            <div className="promise-stat">
              <div className="promise-stat-num">
                5<em>×</em>
              </div>
              <div className="promise-stat-label">
                Minimum tracked return per dollar over 12 months.
              </div>
            </div>
            <div className="promise-stat">
              <div className="promise-stat-num">
                $1.2<em>M</em>
              </div>
              <div className="promise-stat-label">
                Tracked Review Revenue delivered across NY-metro clients in 12
                months.
              </div>
            </div>
            <div className="promise-stat">
              <div className="promise-stat-num">
                18<em>/mo</em>
              </div>
              <div className="promise-stat-label">
                Avg new reviews per month for service clients in the first 90
                days.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PersonalizedPromiseSection({ audit }: { audit: PersonAudit }) {
  const yearlyFull = 399 * 12;
  const minTrackedFull = yearlyFull * 5;
  const sixMoLoss = audit.projection_data?.revenue_impact?.six_month_loss_usd ?? 0;
  return (
    <section className="promise-section">
      <div className="container">
        <div className="promise-inner">
          <div className="promise-eyebrow">§ 05 · Our 5× Return Standard</div>
          <h2 className="promise-title">
            For{" "}
            {audit.google_data?.business?.name ?? "your business"} specifically:{" "}
            <em>$24K minimum</em> in tracked Review Revenue at Full Service.
          </h2>
          <p className="promise-sub">
            $399/month × 12 = ${(399 * 12).toLocaleString()}. Our 5× commitment
            puts your 12-month floor at ${minTrackedFull.toLocaleString()}.
            Anything less and your next month is on us.
          </p>
          <div className="promise-stats">
            <div className="promise-stat">
              <div className="promise-stat-num">
                5<em>×</em>
              </div>
              <div className="promise-stat-label">
                Minimum commitment. Below this floor, next month is on us.
              </div>
            </div>
            <div className="promise-stat">
              <div className="promise-stat-num">
                ${(minTrackedFull / 1000).toFixed(0)}
                <em>K</em>
              </div>
              <div className="promise-stat-label">
                Your specific 12-month minimum at Full Service tier.
              </div>
            </div>
            <div className="promise-stat">
              <div className="promise-stat-num">
                ${Math.round(sixMoLoss / 1000)}
                <em>K</em>
              </div>
              <div className="promise-stat-label">
                Your do-nothing 6-month projection. We aim to invert this.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AuditOffRamp() {
  return (
    <section className="audit-offramp">
      <div className="container">
        <div className="audit-offramp-inner">
          <div className="audit-offramp-text">
            <div className="section-eyebrow">§ 04 · Not sure yet?</div>
            <h2 className="section-title">
              Take the <em>free audit</em> first.
            </h2>
            <p className="section-sub">
              The audit shows you exactly what BAAM Review Service would be
              doing for your business — before you commit to the trial.
            </p>
            <ul className="audit-offramp-list">
              <li>Your current BAAM Review Score — where you stand today</li>
              <li>Your real local competitors, side-by-side</li>
              <li>The do-nothing projection — what reviews are costing you</li>
              <li>The 5-action plan we'd execute on Day 1 of your trial</li>
            </ul>
            <div className="audit-offramp-ctas">
              <Link
                href="/audit/new"
                className="btn btn-primary btn-large"
              >
                Take the free audit →
              </Link>
              <Link
                href={signupHrefForTier("full")}
                className="btn btn-outline btn-large"
              >
                Skip to trial →
              </Link>
            </div>
            <div className="audit-offramp-trust">
              Free audit · No card · Under a minute · Same account = both
              audit + service
            </div>
          </div>
          <div className="audit-preview-card">
            <div className="audit-preview-header">
              <div className="audit-preview-header-row">
                <span className="audit-preview-brand">BAAM · REVIEW AUDIT</span>
                <span className="audit-preview-vol">VOL. I · 2026</span>
              </div>
              <span className="audit-preview-sample-tag">
                △ Sample audit · for demonstration
              </span>
            </div>
            <div className="audit-preview-body">
              <div className="audit-preview-business">
                <h4 className="audit-preview-name">Bridge Street Dental</h4>
                <div className="audit-preview-meta">
                  Brooklyn, NY · Dental practice
                </div>
              </div>
              <div className="audit-preview-score">
                <div className="audit-preview-score-num-wrap">
                  <span className="audit-preview-score-num">52</span>
                  <span className="audit-preview-score-divider">/</span>
                  <span className="audit-preview-score-denom">100</span>
                </div>
                <div className="audit-preview-score-meta">
                  <div className="audit-preview-score-label">
                    BAAM Review Score
                  </div>
                  <div className="audit-preview-grade">
                    Grade C · Below average
                  </div>
                  <div className="audit-preview-diagnosis">
                    4 of 5 competitors rank higher.
                  </div>
                </div>
              </div>
              <div className="audit-preview-projection">
                <div className="audit-preview-projection-label">
                  Do-nothing 6-month projection
                </div>
                <div className="audit-preview-projection-val">
                  <em>−$48,200</em> in lost revenue
                </div>
                <div className="audit-preview-projection-sub">
                  Per BAAM dental benchmarks · $1,340/review
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const faqs = [
    {
      q: <>Do I need a credit card to start the <em>30-day trial?</em></>,
      a: (
        <>
          During the private beta, no. Once we go GA, we'll collect a card to
          prevent abuse — but you won't be charged for 30 days, and you can
          cancel anytime before day 30.
        </>
      ),
    },
    {
      q: <>What happens after the trial ends?</>,
      a: (
        <>
          On day 31, your card is charged for the first month at the tier you
          chose. Switch tiers anytime in account settings.{" "}
          <strong>If you cancel before day 30, you're never charged.</strong>
        </>
      ),
    },
    {
      q: <>What if I already took the <em>free audit?</em></>,
      a: (
        <>
          Your audit account is your service account. When you start the
          trial, you sign in with the same email — no new account needed.
          Your audit data carries over.
        </>
      ),
    },
    {
      q: <>Can I switch between Self-Serve and Full Service?</>,
      a: (
        <>
          Yes, anytime. Upgrade in your account settings; the new rate applies
          on your next billing cycle. <strong>No fees, no penalties.</strong>
        </>
      ),
    },
    {
      q: <>How many locations can one account manage?</>,
      a: (
        <>
          Unlimited. Each additional location is the same flat rate.
          Multi-location groups use BAAM Review for 3-15 locations under one
          account.
        </>
      ),
    },
  ];

  return (
    <section className="faq-section">
      <div className="container">
        <div className="faq-inner">
          <div className="faq-header">
            <div className="section-eyebrow">§ 05 · Common questions</div>
            <h2 className="section-title">
              The things people <em>actually ask.</em>
            </h2>
          </div>
          <div className="faq-list">
            {faqs.map((f, i) => (
              <div key={i} className="faq-item">
                <div className="faq-q">{f.q}</div>
                <div className="faq-a">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// STATE B — Personalized audit summary card + projected outcome
// =============================================================================

function AuditSummaryCard({
  audit,
  businessName,
}: {
  audit: PersonAudit;
  businessName: string;
}) {
  const score = audit.total_score ?? 0;
  const grade = audit.grade ?? "?";
  const sixMoLoss = audit.projection_data?.revenue_impact?.six_month_loss_usd ?? 0;
  const components = audit.score_data?.components ?? {};

  const subscores: Array<{ label: string; key: string }> = [
    { label: "Rating", key: "rating_quality" },
    { label: "Volume", key: "review_volume" },
    { label: "30d velocity", key: "velocity_30d" },
    { label: "6mo velocity", key: "velocity_180d" },
    { label: "12mo velocity", key: "velocity_365d" },
  ];

  return (
    <section className="audit-summary-section">
      <div className="container">
        <div className="audit-summary-card">
          <div className="audit-summary-header">
            <div className="audit-summary-header-left">
              <div className="audit-summary-header-tag">Your latest audit</div>
              <h3 className="audit-summary-header-title">
                {businessName} · {shortId(audit.id)}
              </h3>
              <div className="audit-summary-header-meta">
                {[audit.google_data?.business?.city, audit.google_data?.business?.state]
                  .filter(Boolean)
                  .join(", ")}{" "}
                · Audited{" "}
                {new Date(audit.generated_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
            <Link
              href="/audit/list"
              className="audit-switcher"
              style={{ textDecoration: "none" }}
            >
              <span>Switch audit</span>
            </Link>
          </div>

          <div className="audit-summary-body">
            <div className="audit-summary-score-block">
              <div className="audit-summary-score-label">BAAM Review Score</div>
              <div className="audit-summary-score-num-wrap">
                <span className="audit-summary-score-num">{score}</span>
                <span className="audit-summary-score-divider">/</span>
                <span className="audit-summary-score-denom">100</span>
              </div>
              <div className="audit-summary-grade-row">
                <span className="audit-summary-grade">Grade {grade}</span>
                <span className="audit-summary-grade-text">
                  {gradeBlurb(grade)}
                </span>
              </div>
            </div>

            <div className="audit-summary-data-block">
              <div className="audit-summary-subscores-label">
                Sub-score breakdown
              </div>
              <div className="audit-summary-subscores">
                {subscores.map((s) => {
                  const component = components[s.key];
                  if (!component || component.weight === 0) return null;
                  const val = Math.round(component.raw_score);
                  const cls =
                    val >= 70 ? "good" : val >= 50 ? "ok" : "bad";
                  return (
                    <div key={s.key} className="audit-summary-subscore-row">
                      <span>{s.label}</span>
                      <div className="audit-summary-bar">
                        <div
                          className={`audit-summary-bar-fill ${cls}`}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                      <span className="audit-summary-bar-val">{val}</span>
                    </div>
                  );
                })}
              </div>

              {sixMoLoss > 0 && (
                <div className="audit-summary-projection">
                  <div className="audit-summary-projection-label">
                    Do-nothing 6-month projection
                  </div>
                  <div className="audit-summary-projection-val">
                    <em>−${sixMoLoss.toLocaleString()}</em> in lost revenue
                  </div>
                  <div className="audit-summary-projection-sub">
                    Per industry benchmarks · methodology in full audit
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="audit-summary-footer">
            <div className="audit-summary-footer-info">
              Re-audit available · audits refresh monthly
            </div>
            <Link
              href={`/audit/${audit.id}`}
              className="audit-summary-footer-link"
            >
              View full 7-page audit →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProjectedOutcomeSection({
  projection,
  businessName,
}: {
  projection: ScoreProjection;
  businessName: string;
}) {
  return (
    <section className="projected-outcome-section">
      <div className="container">
        <div className="projected-outcome-header">
          <div className="section-eyebrow">
            § 02 · What service typically delivers
          </div>
          <h2 className="section-title">
            Where {businessName} <em>could land</em>.
          </h2>
          <p className="section-sub">
            Conservative ranges based on similar starting scores. We don't
            promise specific outcomes — we promise to do the work, and the 5×
            Return Standard backs the result.
          </p>
        </div>

        <div className="projected-grid">
          <ProjectedCard
            time="After 90 days"
            range={projection.d90}
            grade={gradeForScore(projection.d90.high)}
            body="Most clients see velocity recovery within 60 days. Score lift bands by starting grade — yours sits in the typical range."
            featured={false}
          />
          <ProjectedCard
            time="After 180 days"
            range={projection.d180}
            grade={gradeForScore(projection.d180.high)}
            body="Volume catches up to rating. Competitor gap starts closing visibly. Review Revenue typically 3–4× service cost by month 6."
            featured
          />
          <ProjectedCard
            time="After 12 months"
            range={projection.m12}
            grade={gradeForScore(projection.m12.high)}
            body="Sustained leadership in your local set. 5× Return Standard hit or refunded. Most clients re-sign annual at this point."
            featured={false}
          />
        </div>

        <div className="projected-caveat">
          <strong>How these ranges are calculated.</strong> Lift bands by
          starting grade, capped at 95. Bottom-of-band is owner-driven
          (Self-Serve); the full band reflects managed execution (Full
          Service). Individual results vary by starting velocity, customer
          flow, and competitive landscape.
        </div>
      </div>
    </section>
  );
}

function ProjectedCard({
  time,
  range,
  grade,
  body,
  featured,
}: {
  time: string;
  range: { low: number; high: number };
  grade: "A" | "B" | "C" | "D" | "F";
  body: string;
  featured: boolean;
}) {
  return (
    <div className={`projected-card ${featured ? "featured" : ""}`.trim()}>
      <div className="projected-card-time">{time}</div>
      <div className="projected-card-range">
        {range.low}{" "}
        <span className="projected-card-range-sep">–</span> {range.high}
      </div>
      <div className="projected-card-grade">Grade {grade}</div>
      <div className="projected-card-body">{body}</div>
    </div>
  );
}

// =============================================================================
// SHARED — projection model (same lift bands as Phase 1's data-mapper)
// =============================================================================

interface ScoreProjection {
  d90: { low: number; high: number };
  d180: { low: number; high: number };
  m12: { low: number; high: number };
}

const LIFT_BANDS_BY_GRADE: Record<
  "A" | "B" | "C" | "D" | "F",
  { d90: [number, number]; d180: [number, number]; m12: [number, number] }
> = {
  F: { d90: [12, 22], d180: [20, 32], m12: [28, 42] },
  D: { d90: [10, 18], d180: [16, 26], m12: [24, 36] },
  C: { d90: [6, 14], d180: [10, 20], m12: [16, 26] },
  B: { d90: [3, 8], d180: [5, 12], m12: [8, 16] },
  A: { d90: [1, 4], d180: [2, 6], m12: [3, 8] },
};

function projectScore(
  startingScore: number,
  startingGrade: "A" | "B" | "C" | "D" | "F",
): ScoreProjection {
  const cap = 95;
  const band = LIFT_BANDS_BY_GRADE[startingGrade];
  const range = (
    lift: [number, number],
  ): { low: number; high: number } => ({
    low: Math.min(startingScore + lift[0], cap),
    high: Math.min(startingScore + lift[1], cap),
  });
  return {
    d90: range(band.d90),
    d180: range(band.d180),
    m12: range(band.m12),
  };
}

function gradeForScore(s: number): "A" | "B" | "C" | "D" | "F" {
  if (s >= 90) return "A";
  if (s >= 75) return "B";
  if (s >= 60) return "C";
  if (s >= 40) return "D";
  return "F";
}

function gradeBlurb(grade: string): string {
  const map: Record<string, string> = {
    A: "Excellent",
    B: "Above average",
    C: "Visible — but losing to stronger competitors",
    D: "Below average — bleeding to better-reviewed peers",
    F: "Effectively invisible to local search",
  };
  return map[grade] ?? "Audited";
}

function daysAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function shortId(id: string): string {
  return `BR-${id.slice(0, 4)}-${id.slice(4, 8)}`.toUpperCase();
}

