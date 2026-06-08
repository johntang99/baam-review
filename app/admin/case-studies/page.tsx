import Link from "next/link";
import { listContentItemsAdmin } from "@/lib/admin/content";
import { NewCaseStudyButton } from "./new-case-study-button";

export const dynamic = "force-dynamic";

export default async function AdminCaseStudiesListPage() {
  const items = await listContentItemsAdmin("case_study");

  return (
    <>
      <header className="cslist-header">
        <div>
          <Link href="/admin" className="cslist-back">
            ← Admin
          </Link>
          <h1 className="cslist-h1">Case studies</h1>
          <p className="cslist-deck">
            {items.length === 0
              ? "No case studies yet — add the first one."
              : `${items.length} case stud${items.length === 1 ? "y" : "ies"}. Published cards appear on /case-studies in the order shown here.`}
          </p>
        </div>
        <NewCaseStudyButton />
      </header>

      {items.length === 0 ? (
        <div className="cslist-empty">
          <p>
            Each case study becomes a card on the public /case-studies page.
            Fields include business name, vertical, before/after stats, owner
            quote, and a short summary. The first three case studies you
            publish replace the placeholder cards we shipped.
          </p>
        </div>
      ) : (
        <div className="cslist-table-wrap">
          <table className="cslist-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Vertical</th>
                <th>Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const fm = p.frontmatter as Record<string, unknown>;
                const name = (fm.businessName as string) || "(unnamed)";
                const vertical = (fm.vertical as string) || "—";
                const city = (fm.city as string) || "";
                const state = (fm.state as string) || "";
                return (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/admin/case-studies/${p.id}`}
                        className="cslist-title"
                      >
                        {name}
                      </Link>
                      {(city || state) && (
                        <div className="cslist-meta">
                          {[city, state].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="cslist-mono">{vertical}</td>
                    <td>
                      <span
                        className={`cslist-status cslist-status-${p.status}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="cslist-mono">
                      {new Date(p.updated_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td>
                      <Link
                        href={`/admin/case-studies/${p.id}`}
                        className="cslist-edit"
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
      )}

      <style>{LIST_CSS}</style>
    </>
  );
}

const LIST_CSS = `
.cslist-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; gap: 20px; flex-wrap: wrap; }
.cslist-back { display: inline-block; font-size: 12px; color: #888; text-decoration: none; margin-bottom: 12px; }
.cslist-back:hover { color: #1c1c1c; }
.cslist-h1 { font-family: 'Fraunces', serif; font-weight: 400; font-size: 32px; line-height: 1.1; letter-spacing: -0.02em; color: #1c1c1c; margin: 0 0 10px; }
.cslist-deck { color: #555; font-size: 14.5px; margin: 0; max-width: 580px; }
.cslist-empty { background: #FBF8F1; border: 1px dashed #DDD3BF; border-radius: 12px; padding: 28px 32px; color: #888; font-style: italic; max-width: 720px; }
.cslist-table-wrap { overflow-x: auto; }
.cslist-table { width: 100%; border-collapse: collapse; background: #FBF8F1; border: 1px solid #E6DECF; border-radius: 12px; overflow: hidden; font-size: 14px; }
.cslist-table th { text-align: left; padding: 12px 16px; background: #F4EFE2; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: #888; font-weight: 600; border-bottom: 1px solid #E6DECF; }
.cslist-table td { padding: 14px 16px; border-bottom: 1px solid #F4EFE2; vertical-align: top; }
.cslist-table tr:last-child td { border-bottom: 0; }
.cslist-title { font-weight: 500; color: #1c1c1c; text-decoration: none; display: block; }
.cslist-title:hover { color: #2D4A3A; }
.cslist-meta { font-size: 12.5px; color: #888; margin-top: 4px; }
.cslist-mono { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #555; }
.cslist-status { display: inline-flex; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; padding: 3px 8px; border-radius: 999px; }
.cslist-status-published { background: rgba(107, 142, 110, 0.15); color: #3F5F4A; }
.cslist-status-draft { background: rgba(201, 169, 97, 0.18); color: #6F5320; }
.cslist-edit { font-size: 13px; color: #2D4A3A; text-decoration: none; font-weight: 500; }
.cslist-edit:hover { color: #1F3528; }
`;
