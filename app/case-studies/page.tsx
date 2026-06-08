import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { readMarketingDoc } from "@/lib/marketing/render";
import { AskQuestionModal } from "@/components/marketing/ask-question-modal";
import { JsonLd } from "@/components/seo/JsonLd";
import { collectionPageSchema } from "@/lib/seo/schemas";
import { listPublishedContent } from "@/lib/admin/content";
import { applyMarketingOverrides } from "@/lib/seo/apply-cms-overrides";

const VERTICAL_LABELS: Record<string, string> = {
  tcm_clinic: "TCM / Acupuncture",
  dental: "Dental Practice",
  legal_immigration: "Legal / Immigration",
  restaurant: "Restaurant",
  real_estate: "Real Estate",
  hotel: "Hotel",
  auto: "Auto Services",
  contractor: "Contractor",
  salon_spa: "Day Spa / Salon",
  cafe: "Café",
  apparel: "Apparel",
  health_food: "Health Food",
  insurance: "Insurance",
  general_smb: "Local Business",
};

/**
 * Slice the static cs-list section out of the marketing HTML so we can
 * render published case studies from the DB in its place. If no
 * case studies are published yet, the static section stays put with
 * its {{TODO}} placeholders so the page still looks shipped.
 */
function spliceCsList(html: string, published: boolean): {
  before: string;
  after: string;
} {
  if (!published) {
    return { before: html, after: "" };
  }
  // Match the entire <section class="cs-list">...</section> block,
  // including the comment markers between cards. Lazy match keeps it
  // from spanning past the first closing tag.
  const re = /<section class="cs-list">[\s\S]*?<\/section>/;
  const match = html.match(re);
  if (!match || match.index === undefined) {
    return { before: html, after: "" };
  }
  return {
    before: html.slice(0, match.index),
    after: html.slice(match.index + match[0].length),
  };
}

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://baamreview.com";

export const metadata: Metadata = {
  title: "Case Studies — BAAM Review",
  description:
    "Real businesses, real numbers — see what BAAM Review did for local owners.",
  alternates: { canonical: `${BASE_URL}/case-studies` },
};

export const dynamic = "force-dynamic";

export default async function CaseStudiesPage() {
  const { css, bodyHtml } = readMarketingDoc("marketing-case-studies.html");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  const studies = await listPublishedContent("case_study").catch(() => []);

  const AUTH_SLOT_RE =
    /(<div data-nav-auth-slot[^>]*>)[\s\S]*?(<\/div>)/;
  let finalHtml = user
    ? bodyHtml.replace(AUTH_SLOT_RE, `$1${renderSignedInCluster()}$2`)
    : bodyHtml;

  // Apply page-chrome CMS overrides (hero eyebrow / headline / deck)
  // BEFORE we splice out the cs-list section, so the splice still
  // finds its anchor.
  finalHtml = await applyMarketingOverrides(finalHtml, "case-studies");

  // When DB has published case studies, splice out the static
  // placeholder cards and inject DB-driven cards at the same spot.
  const { before, after } = spliceCsList(finalHtml, studies.length > 0);
  finalHtml = before;

  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          path: "/case-studies",
          name: "Case Studies — BAAM Review",
          description:
            "Real businesses, real numbers — see what BAAM Review did for local owners.",
        })}
      />
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: finalHtml }}
      />

      {studies.length > 0 && (
        <section className="cs-list">
          {studies.map((s) => {
            const fm = s.frontmatter as Record<string, unknown>;
            const businessName = (fm.businessName as string) || "—";
            const city = (fm.city as string) || "";
            const state = (fm.state as string) || "";
            const vertical = (fm.vertical as string) || "";
            const verticalLabel = VERTICAL_LABELS[vertical] ?? vertical;
            const beforeRating = Number(fm.beforeRating ?? 0);
            const afterRating = Number(fm.afterRating ?? 0);
            const beforeReviewCount = Number(fm.beforeReviewCount ?? 0);
            const afterReviewCount = Number(fm.afterReviewCount ?? 0);
            const monthsOnBaam = Number(fm.monthsOnBaam ?? 0);
            const ownerName = (fm.ownerName as string) || "";
            const ownerRole = (fm.ownerRole as string) || "";
            const quote = (fm.quote as string) || "";
            const summary = (fm.summary as string) || "";
            return (
              <article key={s.id} className="case-card">
                <div className="case-card-side">
                  {verticalLabel && (
                    <span className="case-card-tag">{verticalLabel}</span>
                  )}
                  <div>
                    <div className="case-card-business">{businessName}</div>
                    {(city || state) && (
                      <div
                        className="case-card-meta"
                        style={{ marginTop: 6 }}
                      >
                        {[city, state].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="case-card-stats">
                    {beforeRating > 0 && afterRating > 0 && (
                      <div className="case-stat">
                        <div className="case-stat-label">Google rating</div>
                        <div className="case-stat-row">
                          <span className="case-stat-before">
                            {beforeRating.toFixed(1)}★
                          </span>
                          <span className="case-stat-arrow">→</span>
                          <span className="case-stat-after up">
                            {afterRating.toFixed(1)}★
                          </span>
                        </div>
                      </div>
                    )}
                    {(beforeReviewCount > 0 || afterReviewCount > 0) && (
                      <div className="case-stat">
                        <div className="case-stat-label">Total reviews</div>
                        <div className="case-stat-row">
                          {beforeReviewCount > 0 && (
                            <>
                              <span className="case-stat-before">
                                {beforeReviewCount}
                              </span>
                              <span className="case-stat-arrow">→</span>
                            </>
                          )}
                          <span className="case-stat-after up">
                            {afterReviewCount}
                          </span>
                        </div>
                      </div>
                    )}
                    {monthsOnBaam > 0 && (
                      <div className="case-stat">
                        <div className="case-stat-label">On BAAM</div>
                        <div className="case-stat-row">
                          <span className="case-stat-after">
                            {monthsOnBaam} mo
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="case-card-main">
                  {quote && (
                    <div className="case-card-quote">
                      &ldquo;{quote}&rdquo;
                      {(ownerName || ownerRole) && (
                        <div className="case-card-attrib">
                          — <strong>{ownerName}</strong>
                          {ownerRole && `, ${ownerRole}`}
                        </div>
                      )}
                    </div>
                  )}
                  {summary && (
                    <p className="case-card-summary">{summary}</p>
                  )}
                  <a href="/audit/" className="case-card-link">
                    Get your own audit →
                  </a>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <div
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: after }}
      />

      <AskQuestionModal />
    </>
  );
}

function renderSignedInCluster(): string {
  return `
    <a href="/audit/list" class="nav-cta-signin" title="My audits" aria-label="My audits" style="display:inline-flex;align-items:center;color:var(--text-soft);font-size:14px;">My audits</a>
    <form action="/api/auth/signout" method="post" style="margin:0;">
      <input type="hidden" name="next" value="/case-studies">
      <button type="submit" style="background:none;border:none;padding:0;margin:0;font-family:inherit;font-size:14px;color:var(--text-soft);cursor:pointer;line-height:1;">Sign out</button>
    </form>
  `;
}
