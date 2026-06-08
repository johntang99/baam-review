import Link from "next/link";
import { listContentItemsAdmin } from "@/lib/admin/content";

export const dynamic = "force-dynamic";

/**
 * Admin overview — quick counts per content type and shortcuts to the
 * most common actions. Editors land here after sign-in.
 */
export default async function AdminOverviewPage() {
  // Each list call hits a separate query; small dataset, low cost.
  // If this gets slow we'll consolidate into one count-by-kind query.
  const [blog, caseStudies, cities, marketing] = await Promise.all([
    listContentItemsAdmin("blog_post").catch(() => []),
    listContentItemsAdmin("case_study").catch(() => []),
    listContentItemsAdmin("city_page").catch(() => []),
    listContentItemsAdmin("marketing_page").catch(() => []),
  ]);

  const sections: Array<{
    title: string;
    href: string;
    items: typeof blog;
    description: string;
    cta: string;
  }> = [
    {
      title: "Blog posts",
      href: "/admin/blog",
      items: blog,
      description:
        "Long-form research, playbooks, and case studies. Drives organic SEO traffic.",
      cta: "Manage blog →",
    },
    {
      title: "Case studies",
      href: "/admin/case-studies",
      items: caseStudies,
      description:
        "Real client stories that appear on /case-studies. Each card has stats + quote + summary.",
      cta: "Manage case studies →",
    },
    {
      title: "City pages",
      href: "/admin/cities",
      items: cities,
      description:
        "Editorial copy for /local/<city> pages. Aggregate stats stay auto-computed from audit data.",
      cta: "Manage city pages →",
    },
    {
      title: "Marketing pages",
      href: "/admin/marketing",
      items: marketing,
      description:
        "Editable sections of /about, /contact, and other static marketing pages.",
      cta: "Manage marketing pages →",
    },
  ];

  return (
    <>
      <header className="overview-header">
        <p className="overview-eyebrow">Content admin</p>
        <h1 className="overview-h1">Marketing &amp; SEO content</h1>
        <p className="overview-deck">
          Edit every page that drives organic discovery and converts visitors
          into free audits. Changes here are live within seconds.
        </p>
      </header>

      <section className="overview-grid">
        {sections.map((section) => {
          const published = section.items.filter(
            (i) => i.status === "published",
          ).length;
          const drafts = section.items.length - published;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="overview-card"
            >
              <div className="overview-card-head">
                <h2 className="overview-card-title">{section.title}</h2>
                <span className="overview-card-counts">
                  <strong>{published}</strong> published
                  {drafts > 0 && (
                    <>
                      {" · "}
                      <strong className="overview-card-drafts">
                        {drafts}
                      </strong>{" "}
                      draft{drafts === 1 ? "" : "s"}
                    </>
                  )}
                </span>
              </div>
              <p className="overview-card-body">{section.description}</p>
              <span className="overview-card-cta">{section.cta}</span>
            </Link>
          );
        })}
      </section>

      <style>{OVERVIEW_CSS}</style>
    </>
  );
}

const OVERVIEW_CSS = `
.overview-header { margin-bottom: 36px; }
.overview-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #6F5320;
  font-weight: 600;
  margin: 0 0 14px;
}
.overview-h1 {
  font-family: 'Fraunces', serif;
  font-weight: 400;
  font-size: 36px;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #1c1c1c;
  margin: 0 0 12px;
}
.overview-deck {
  font-family: 'Newsreader', serif;
  font-style: italic;
  font-size: 17px;
  line-height: 1.55;
  color: #555;
  max-width: 560px;
  margin: 0;
}
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 700px) { .overview-grid { grid-template-columns: 1fr; } }
.overview-card {
  background: #FBF8F1;
  border: 1px solid #E6DECF;
  border-radius: 14px;
  padding: 22px 24px 20px;
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.12s, transform 0.06s;
}
.overview-card:hover { border-color: #1c1c1c; transform: translateY(-1px); }
.overview-card-head {
  display: flex; justify-content: space-between; align-items: baseline;
  gap: 12px; flex-wrap: wrap;
}
.overview-card-title {
  font-family: 'Fraunces', serif;
  font-weight: 500;
  font-size: 19px;
  color: #1c1c1c;
  margin: 0;
}
.overview-card-counts {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #888;
  letter-spacing: 0.04em;
}
.overview-card-counts strong { color: #1c1c1c; font-weight: 500; }
.overview-card-drafts { color: #6F5320 !important; }
.overview-card-body {
  font-size: 13.5px;
  color: #555;
  line-height: 1.55;
  margin: 0;
}
.overview-card-cta {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #2D4A3A;
}
`;
