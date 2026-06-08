import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CITIES } from "@/lib/seo/cities";
import { resolveCity, listAllCitySlugs } from "@/lib/seo/cities-resolve";
import {
  getCityStats,
  VERTICAL_DISPLAY,
} from "@/lib/audit/research/city-stats";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  breadcrumbSchema,
  faqPageSchema,
  localBusinessSchema,
} from "@/lib/seo/schemas";
import { BlogShell } from "@/app/blog/blog-shell";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://baamreview.com";

interface RouteParams {
  params: Promise<{ city: string }>;
}

export async function generateMetadata(
  { params }: RouteParams,
): Promise<Metadata> {
  const { city } = await params;
  const entry = await resolveCity(city);
  if (!entry) return { title: "Not found — BAAM Review" };

  const title = `Review marketing for ${entry.displayName}, ${entry.state} | BAAM Review`;
  const description = `Local-search audit data, review benchmarks, and review marketing services for businesses in ${entry.displayName}, ${entry.state}. Free 7-page audit. Bilingual support.`;
  const url = `${BASE_URL}/local/${entry.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
  };
}

export async function generateStaticParams() {
  const slugs = await listAllCitySlugs();
  return slugs.map((city) => ({ city }));
}

export const dynamic = "force-static";
export const revalidate = 86400; // re-aggregate stats once a day

export default async function CityPage({ params }: RouteParams) {
  const { city } = await params;
  const entry = await resolveCity(city);
  if (!entry) notFound();

  const stats = await getCityStats(entry);

  // Even if stats are too thin to display, we still render the page —
  // we just hide the numeric block. This avoids 404ing markets we've
  // already committed to ranking for. Sub-threshold cities can ship
  // with editorial copy alone for a few weeks until audit volume
  // catches up.
  const hasStats = stats && stats.totalAudits >= 5;

  const faqItems = [
    {
      question: `How many businesses has BAAM Review audited in ${entry.displayName}?`,
      answer: hasStats
        ? `As of the last update, ${stats!.totalAudits} businesses in ${entry.displayName}, ${entry.state}.`
        : `We audit ${entry.displayName} businesses on request. Start a free audit and your business is included in the dataset.`,
    },
    {
      question: `What's a good Google rating for a ${entry.displayName} business?`,
      answer: hasStats && stats!.medianRating
        ? `The median rating across audited ${entry.displayName} businesses is ${stats!.medianRating.toFixed(1)} stars. 4.0 is the threshold where ~70% of consumers stop filtering you out — anything below that hurts conversion significantly.`
        : `4.0 stars is the threshold where ~70% of consumers stop filtering you out. Anything below hurts conversion significantly regardless of city.`,
    },
    {
      question: `Do you serve bilingual businesses in ${entry.displayName}?`,
      answer: `Yes — BAAM Review ships with EN + 中文 review templates, audit reports, and AI reply drafting as default features. Spanish is on the roadmap.`,
    },
    {
      question: `How much does this cost?`,
      answer: `The audit is free. The service runs $99/month self-serve or $399/month full-service, with a 30-day free trial.`,
    },
  ];

  const schemaEntities: Record<string, unknown>[] = [
    localBusinessSchema({
      path: `/local/${entry.slug}`,
      city: entry.displayName,
      state: entry.state,
      postalCode: entry.postalCode,
    }),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Local", path: "/local/flushing" }, // no /local index yet; point at Flushing as a sane fallback
      {
        name: `${entry.displayName}, ${entry.state}`,
        path: `/local/${entry.slug}`,
      },
    ]),
    faqPageSchema({ path: `/local/${entry.slug}`, items: faqItems }),
  ];

  return (
    <>
      <JsonLd data={schemaEntities} />
      <style>{LOCAL_CSS}</style>

      <BlogShell active="index">
        <article>
          <header className="local-hero">
            <p className="local-eyebrow">
              Local · {entry.displayName}, {entry.state}
            </p>
            <h1 className="local-h1">
              Review marketing for {entry.displayName} businesses.
            </h1>
            <p className="local-deck">{entry.intro}</p>
          </header>

          {hasStats && (
            <section className="local-stats" aria-label="City benchmarks">
              <div className="local-stats-grid">
                <div className="local-stat">
                  <div className="local-stat-num">{stats!.totalAudits}</div>
                  <div className="local-stat-label">Businesses audited</div>
                </div>
                {stats!.medianRating !== null && (
                  <div className="local-stat">
                    <div className="local-stat-num">
                      {stats!.medianRating.toFixed(1)}★
                    </div>
                    <div className="local-stat-label">Median rating</div>
                  </div>
                )}
                {stats!.medianReviewCount !== null && (
                  <div className="local-stat">
                    <div className="local-stat-num">
                      {Math.round(stats!.medianReviewCount)}
                    </div>
                    <div className="local-stat-label">Median review count</div>
                  </div>
                )}
                <div className="local-stat">
                  <div className="local-stat-num">EN + 中文</div>
                  <div className="local-stat-label">Languages supported</div>
                </div>
              </div>
              {stats!.lastAuditedAt && (
                <p className="local-stats-asof">
                  Last updated{" "}
                  {new Date(stats!.lastAuditedAt).toLocaleDateString(
                    "en-US",
                    { year: "numeric", month: "short", day: "numeric" },
                  )}
                </p>
              )}
            </section>
          )}

          <section className="local-section">
            <h2>Why we focus on {entry.displayName}</h2>
            <p className="local-prose">{entry.whyHere}</p>
          </section>

          {hasStats && stats!.topVerticals.length > 0 && (
            <section className="local-section">
              <h2>
                Most-audited verticals in {entry.displayName}
              </h2>
              <p className="local-prose">
                What kind of local business shows up in our {entry.displayName}{" "}
                audit dataset most often.
              </p>
              <ul className="local-vertical-list">
                {stats!.topVerticals.map((v) => (
                  <li key={v.vertical} className="local-vertical-item">
                    <span className="local-vertical-name">
                      {VERTICAL_DISPLAY[v.vertical] ?? v.vertical}
                    </span>
                    <span className="local-vertical-bar">
                      <span
                        className="local-vertical-fill"
                        style={{ width: `${v.share * 100}%` }}
                      />
                    </span>
                    <span className="local-vertical-count">{v.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasStats && stats!.featuredBusinesses.length > 0 && (
            <section className="local-section">
              <h2>Recently audited in {entry.displayName}</h2>
              <p className="local-prose">
                A small sample of the businesses we&apos;ve produced full
                audits for. Names + ratings are from public Google data.
              </p>
              <table className="local-table">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Rating</th>
                    <th>Reviews</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {stats!.featuredBusinesses.map((b) => (
                    <tr key={b.name}>
                      <td>{b.name}</td>
                      <td>{b.rating.toFixed(1)}★</td>
                      <td>{b.reviewCount}</td>
                      <td>{b.grade ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="local-section">
            <h2>
              Get a free audit for your {entry.displayName} business
            </h2>
            <p className="local-prose">
              We&apos;ll generate a 7-page audit showing your current Google
              standing, your closest competitors in {entry.displayName}, and
              the 5 actions that would move your ranking the most. Takes about
              60 seconds.
            </p>
            <Link href="/audit/" className="local-cta">
              Start free audit →
            </Link>
          </section>

          <section className="local-section">
            <h2>Frequently asked questions</h2>
            {faqItems.map((item, i) => (
              <div key={i} className="local-faq-item">
                <p className="local-faq-q">{item.question}</p>
                <p className="local-faq-a">{item.answer}</p>
              </div>
            ))}
          </section>

          <section className="local-section local-section-other">
            <h2>Other cities we serve</h2>
            <ul className="local-other-list">
              {CITIES.filter((c) => c.slug !== entry.slug).map((c) => (
                <li key={c.slug}>
                  <Link href={`/local/${c.slug}`}>
                    {c.displayName}, {c.state}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </BlogShell>
    </>
  );
}

const LOCAL_CSS = `
.local-hero { margin-bottom: 40px; padding-bottom: 28px; border-bottom: 1px solid var(--bl-border); }
.local-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--bl-gold-dark);
  font-weight: 600;
  margin: 0 0 18px;
}
.local-h1 {
  font-family: 'Fraunces', 'Instrument Serif', serif;
  font-weight: 400;
  font-size: clamp(34px, 4.5vw, 52px);
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: var(--bl-ink);
  margin: 0 0 16px;
}
.local-deck {
  font-family: 'Newsreader', Georgia, serif;
  font-style: italic;
  font-size: 19px;
  line-height: 1.55;
  color: var(--bl-text-soft);
  margin: 0;
  max-width: 660px;
}

.local-stats {
  background: var(--bl-paper);
  border: 1px solid var(--bl-border);
  border-radius: 14px;
  padding: 24px 26px 16px;
  margin-bottom: 40px;
}
.local-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
}
@media (max-width: 640px) {
  .local-stats-grid { grid-template-columns: repeat(2, 1fr); }
}
.local-stat-num {
  font-family: 'Fraunces', 'Instrument Serif', serif;
  font-size: 32px;
  font-weight: 500;
  color: var(--bl-ink);
  letter-spacing: -0.01em;
  line-height: 1.1;
}
.local-stat-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bl-text-muted);
  font-weight: 600;
  margin-top: 6px;
}
.local-stats-asof {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--bl-text-muted);
  margin: 16px 0 0;
}

.local-section { margin: 40px 0; }
.local-section h2 {
  font-family: 'Fraunces', 'Instrument Serif', serif;
  font-weight: 500;
  font-size: 26px;
  line-height: 1.2;
  letter-spacing: -0.012em;
  color: var(--bl-ink);
  margin: 0 0 14px;
}
.local-prose {
  font-family: 'Newsreader', Georgia, serif;
  font-size: 17px;
  line-height: 1.7;
  color: var(--bl-text);
  margin: 0 0 16px;
}

.local-vertical-list {
  list-style: none;
  padding: 0;
  margin: 18px 0 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.local-vertical-item {
  display: grid;
  grid-template-columns: 180px 1fr 40px;
  align-items: center;
  gap: 14px;
  font-size: 14px;
  color: var(--bl-text);
}
.local-vertical-name { font-weight: 500; color: var(--bl-ink); }
.local-vertical-bar {
  background: var(--bl-cream-deep);
  border-radius: 999px;
  height: 8px;
  overflow: hidden;
}
.local-vertical-fill {
  display: block;
  height: 100%;
  background: var(--bl-gold);
  border-radius: 999px;
}
.local-vertical-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  color: var(--bl-text-muted);
  text-align: right;
}

.local-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
  font-family: 'Onest', sans-serif;
  font-size: 14.5px;
}
.local-table th, .local-table td {
  text-align: left;
  padding: 12px 14px;
  border-bottom: 1px solid var(--bl-rule);
}
.local-table th {
  background: var(--bl-cream-deep);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--bl-text-muted);
  font-weight: 600;
}
.local-table td:first-child { font-weight: 500; color: var(--bl-ink); }

.local-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 22px;
  background: var(--bl-forest);
  color: var(--bl-cream);
  border-radius: 999px;
  font-family: 'Onest', sans-serif;
  font-size: 14.5px;
  font-weight: 500;
  text-decoration: none;
  margin-top: 4px;
}
.local-cta:hover { background: var(--bl-forest-dark); }

.local-faq-item { margin-bottom: 22px; }
.local-faq-q {
  font-family: 'Onest', sans-serif;
  font-weight: 600;
  font-size: 15.5px;
  color: var(--bl-ink);
  margin: 0 0 6px;
}
.local-faq-a {
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--bl-text-soft);
  margin: 0;
}

.local-section-other { border-top: 1px solid var(--bl-border); padding-top: 36px; }
.local-other-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.local-other-list a {
  color: var(--bl-forest);
  font-size: 14px;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.local-other-list a:hover { color: var(--bl-forest-dark); }
`;
