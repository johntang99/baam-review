import Link from "next/link";
import { listContentItemsAdmin } from "@/lib/admin/content";
import { CITIES } from "@/lib/seo/cities";
import { CityAdminActions } from "./actions";

export const dynamic = "force-dynamic";

/**
 * /admin/cities — list view that merges:
 *   - The static city registry in lib/seo/cities.ts (the original
 *     pages we shipped, editable in code but not visible here)
 *   - DB content_items of kind 'city_page' (overrides + new cities)
 *
 * DB rows take precedence — when a city has both a registry entry and
 * a DB row, the DB row's editorial copy is what /local/<slug> renders.
 *
 * Adding a new city: click "+ New city page" → register the slug,
 * displayName, state. The site shows that city's page once it's
 * published; aggregate stats from audit data flow in automatically.
 */
export default async function AdminCitiesListPage() {
  const items = await listContentItemsAdmin("city_page");
  const dbBySlug = new Map(items.map((i) => [i.slug, i]));

  // Display all registry cities plus any DB cities that aren't in the
  // registry. Registry cities without a DB row show as "code only" so
  // editors know the editorial copy lives in lib/seo/cities.ts.
  const allSlugs = new Set<string>([
    ...CITIES.map((c) => c.slug),
    ...items.map((i) => i.slug),
  ]);

  type Row = {
    slug: string;
    displayName: string;
    state: string;
    inDb: boolean;
    inRegistry: boolean;
    status: "draft" | "published" | "code-only";
    dbId?: string;
    updatedAt?: string;
  };

  const rows: Row[] = Array.from(allSlugs).map((slug) => {
    const item = dbBySlug.get(slug);
    const registry = CITIES.find((c) => c.slug === slug);
    return {
      slug,
      displayName:
        ((item?.frontmatter as Record<string, unknown>)?.displayName as string) ||
        registry?.displayName ||
        slug,
      state:
        ((item?.frontmatter as Record<string, unknown>)?.state as string) ||
        registry?.state ||
        "",
      inDb: !!item,
      inRegistry: !!registry,
      status: item ? (item.status as "draft" | "published") : "code-only",
      dbId: item?.id,
      updatedAt: item?.updated_at,
    };
  });

  rows.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <>
      <header className="ct-header">
        <div>
          <Link href="/admin" className="ct-back">
            ← Admin
          </Link>
          <h1 className="ct-h1">City pages</h1>
          <p className="ct-deck">
            Editorial copy for /local/&lt;slug&gt; pages. Aggregate stats
            (median rating, top verticals, featured businesses) are
            auto-computed from audit data and don&apos;t need editing
            here.
          </p>
        </div>
        <CityAdminActions />
      </header>

      <div className="ct-table-wrap">
        <table className="ct-table">
          <thead>
            <tr>
              <th>City</th>
              <th>Source</th>
              <th>Status</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug}>
                <td>
                  <div className="ct-cell-name">
                    {r.displayName}
                    {r.state && (
                      <span className="ct-cell-state">, {r.state}</span>
                    )}
                  </div>
                  <div className="ct-cell-slug">/local/{r.slug}</div>
                </td>
                <td>
                  <span className="ct-source">
                    {r.inDb && r.inRegistry
                      ? "DB (overrides code)"
                      : r.inDb
                        ? "DB only"
                        : "Code only"}
                  </span>
                </td>
                <td>
                  <span
                    className={`ct-status ct-status-${r.status}`}
                  >
                    {r.status === "code-only"
                      ? "in code"
                      : r.status}
                  </span>
                </td>
                <td className="ct-mono">
                  {r.updatedAt
                    ? new Date(r.updatedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </td>
                <td>
                  {r.dbId ? (
                    <Link
                      href={`/admin/cities/${r.dbId}`}
                      className="ct-edit"
                    >
                      Edit →
                    </Link>
                  ) : (
                    <a
                      href={`/local/${r.slug}`}
                      target="_blank"
                      rel="noopener"
                      className="ct-edit ct-edit-muted"
                    >
                      View live ↗
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{LIST_CSS}</style>
    </>
  );
}

const LIST_CSS = `
.ct-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; gap: 20px; flex-wrap: wrap; }
.ct-back { display: inline-block; font-size: 12px; color: #888; text-decoration: none; margin-bottom: 12px; }
.ct-back:hover { color: #1c1c1c; }
.ct-h1 { font-family: 'Fraunces', serif; font-weight: 400; font-size: 32px; line-height: 1.1; letter-spacing: -0.02em; color: #1c1c1c; margin: 0 0 10px; }
.ct-deck { color: #555; font-size: 14.5px; margin: 0; max-width: 620px; }
.ct-table-wrap { overflow-x: auto; }
.ct-table { width: 100%; border-collapse: collapse; background: #FBF8F1; border: 1px solid #E6DECF; border-radius: 12px; overflow: hidden; font-size: 14px; }
.ct-table th { text-align: left; padding: 12px 16px; background: #F4EFE2; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: #888; font-weight: 600; border-bottom: 1px solid #E6DECF; }
.ct-table td { padding: 14px 16px; border-bottom: 1px solid #F4EFE2; vertical-align: top; }
.ct-table tr:last-child td { border-bottom: 0; }
.ct-cell-name { font-weight: 500; color: #1c1c1c; font-family: 'Fraunces', serif; font-size: 15.5px; }
.ct-cell-state { color: #888; font-weight: 400; font-size: 14px; }
.ct-cell-slug { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #888; margin-top: 3px; }
.ct-source { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.08em; color: #6F5320; }
.ct-status { display: inline-flex; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; padding: 3px 8px; border-radius: 999px; }
.ct-status-published { background: rgba(107, 142, 110, 0.15); color: #3F5F4A; }
.ct-status-draft { background: rgba(201, 169, 97, 0.18); color: #6F5320; }
.ct-status-code-only { background: rgba(28, 28, 28, 0.08); color: #555; }
.ct-mono { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #555; }
.ct-edit { font-size: 13px; color: #2D4A3A; text-decoration: none; font-weight: 500; }
.ct-edit:hover { color: #1F3528; }
.ct-edit-muted { color: #888; }
.ct-edit-muted:hover { color: #1c1c1c; }
`;
