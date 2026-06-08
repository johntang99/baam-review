import Link from "next/link";
import { listContentItemsAdmin } from "@/lib/admin/content";
import { MARKETING_PAGES } from "@/lib/seo/marketing-pages";

export const dynamic = "force-dynamic";

/**
 * Marketing-page admin list. Shows every registered page from
 * lib/seo/marketing-pages.ts; status reflects whether overrides have
 * been published in the DB.
 *
 * Marketing pages are pre-defined (you can't add a new one from the
 * admin) because each one is tied to a hand-styled HTML file in
 * /public. Adding a new marketing page = adding a new registry entry
 * + creating the HTML, both of which need an engineering touch.
 */
export default async function AdminMarketingListPage() {
  const items = await listContentItemsAdmin("marketing_page");
  const dbBySlug = new Map(items.map((i) => [i.slug, i]));

  return (
    <>
      <header className="mk-header">
        <div>
          <Link href="/admin" className="mk-back">
            ← Admin
          </Link>
          <h1 className="mk-h1">Marketing pages</h1>
          <p className="mk-deck">
            Override hero copy and other named sections on /about, /contact,
            and other marketing pages. The HTML layout itself is editable
            only in code.
          </p>
        </div>
      </header>

      <div className="mk-table-wrap">
        <table className="mk-table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Path</th>
              <th>Status</th>
              <th>Editable sections</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {MARKETING_PAGES.map((page) => {
              const item = dbBySlug.get(page.slug);
              const status: "draft" | "published" | "default" = item
                ? (item.status as "draft" | "published")
                : "default";
              return (
                <tr key={page.slug}>
                  <td>
                    <div className="mk-name">{page.displayName}</div>
                    <div className="mk-desc">{page.description}</div>
                  </td>
                  <td className="mk-mono">{page.path}</td>
                  <td>
                    <span
                      className={`mk-status mk-status-${status}`}
                    >
                      {status === "default" ? "using defaults" : status}
                    </span>
                  </td>
                  <td className="mk-mono">{page.fields.length}</td>
                  <td>
                    <Link
                      href={`/admin/marketing/${page.slug}`}
                      className="mk-edit"
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{LIST_CSS}</style>
    </>
  );
}

const LIST_CSS = `
.mk-header { margin-bottom: 30px; }
.mk-back { display: inline-block; font-size: 12px; color: #888; text-decoration: none; margin-bottom: 12px; }
.mk-back:hover { color: #1c1c1c; }
.mk-h1 { font-family: 'Fraunces', serif; font-weight: 400; font-size: 32px; line-height: 1.1; letter-spacing: -0.02em; color: #1c1c1c; margin: 0 0 10px; }
.mk-deck { color: #555; font-size: 14.5px; margin: 0; max-width: 620px; }
.mk-table-wrap { overflow-x: auto; }
.mk-table { width: 100%; border-collapse: collapse; background: #FBF8F1; border: 1px solid #E6DECF; border-radius: 12px; overflow: hidden; font-size: 14px; }
.mk-table th { text-align: left; padding: 12px 16px; background: #F4EFE2; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: #888; font-weight: 600; border-bottom: 1px solid #E6DECF; }
.mk-table td { padding: 14px 16px; border-bottom: 1px solid #F4EFE2; vertical-align: top; }
.mk-table tr:last-child td { border-bottom: 0; }
.mk-name { font-weight: 500; color: #1c1c1c; font-family: 'Fraunces', serif; font-size: 15.5px; }
.mk-desc { font-size: 12.5px; color: #888; margin-top: 4px; max-width: 360px; line-height: 1.5; }
.mk-mono { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #555; }
.mk-status { display: inline-flex; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; padding: 3px 8px; border-radius: 999px; }
.mk-status-published { background: rgba(107, 142, 110, 0.15); color: #3F5F4A; }
.mk-status-draft { background: rgba(201, 169, 97, 0.18); color: #6F5320; }
.mk-status-default { background: rgba(28, 28, 28, 0.08); color: #555; }
.mk-edit { font-size: 13px; color: #2D4A3A; text-decoration: none; font-weight: 500; }
.mk-edit:hover { color: #1F3528; }
`;
