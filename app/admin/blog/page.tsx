import Link from "next/link";
import { listContentItemsAdmin } from "@/lib/admin/content";
import { NewBlogPostButton } from "./new-blog-post-button";

export const dynamic = "force-dynamic";

/**
 * /admin/blog — list of blog posts (draft + published).
 */
export default async function AdminBlogListPage() {
  const posts = await listContentItemsAdmin("blog_post");

  return (
    <>
      <header className="bloglist-header">
        <div>
          <Link href="/admin" className="bloglist-back">
            ← Admin
          </Link>
          <h1 className="bloglist-h1">Blog posts</h1>
          <p className="bloglist-deck">
            {posts.length === 0
              ? "No posts yet — create the first one."
              : `${posts.length} post${posts.length === 1 ? "" : "s"}, sorted by most recently updated.`}
          </p>
        </div>
        <NewBlogPostButton />
      </header>

      {posts.length === 0 ? (
        <div className="bloglist-empty">
          <p>
            Drafts and published posts show up here. The first post you ship
            should be the cornerstone research report — pick a high-traffic
            question, answer it with original audit data.
          </p>
        </div>
      ) : (
        <div className="bloglist-table-wrap">
          <table className="bloglist-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => {
                const fm = p.frontmatter as Record<string, unknown>;
                const title = (fm.title as string) || "(untitled)";
                const description = (fm.description as string) || "";
                return (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/admin/blog/${p.id}`}
                        className="bloglist-title"
                      >
                        {title}
                      </Link>
                      {description && (
                        <div className="bloglist-description">
                          {description}
                        </div>
                      )}
                    </td>
                    <td className="bloglist-mono">{p.slug}</td>
                    <td>
                      <span
                        className={`bloglist-status bloglist-status-${p.status}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="bloglist-mono">
                      {new Date(p.updated_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td>
                      <Link
                        href={`/admin/blog/${p.id}`}
                        className="bloglist-edit"
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

      <style>{BLOGLIST_CSS}</style>
    </>
  );
}

const BLOGLIST_CSS = `
.bloglist-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
  gap: 20px;
  flex-wrap: wrap;
}
.bloglist-back {
  display: inline-block;
  font-size: 12px;
  color: #888;
  text-decoration: none;
  margin-bottom: 12px;
}
.bloglist-back:hover { color: #1c1c1c; }
.bloglist-h1 {
  font-family: 'Fraunces', serif;
  font-weight: 400;
  font-size: 32px;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #1c1c1c;
  margin: 0 0 10px;
}
.bloglist-deck { color: #555; font-size: 14.5px; margin: 0; }
.bloglist-empty {
  background: #FBF8F1;
  border: 1px dashed #DDD3BF;
  border-radius: 12px;
  padding: 28px 32px;
  color: #888;
  font-style: italic;
  max-width: 620px;
}
.bloglist-table-wrap { overflow-x: auto; }
.bloglist-table {
  width: 100%;
  border-collapse: collapse;
  background: #FBF8F1;
  border: 1px solid #E6DECF;
  border-radius: 12px;
  overflow: hidden;
  font-size: 14px;
}
.bloglist-table th {
  text-align: left;
  padding: 12px 16px;
  background: #F4EFE2;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #888;
  font-weight: 600;
  border-bottom: 1px solid #E6DECF;
}
.bloglist-table td {
  padding: 14px 16px;
  border-bottom: 1px solid #F4EFE2;
  vertical-align: top;
}
.bloglist-table tr:last-child td { border-bottom: 0; }
.bloglist-title {
  font-weight: 500;
  color: #1c1c1c;
  text-decoration: none;
  display: block;
}
.bloglist-title:hover { color: #2D4A3A; }
.bloglist-description {
  font-size: 12.5px;
  color: #888;
  margin-top: 4px;
  max-width: 360px;
}
.bloglist-mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  color: #555;
}
.bloglist-status {
  display: inline-flex;
  align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
}
.bloglist-status-published {
  background: rgba(107, 142, 110, 0.15);
  color: #3F5F4A;
}
.bloglist-status-draft {
  background: rgba(201, 169, 97, 0.18);
  color: #6F5320;
}
.bloglist-edit {
  font-size: 13px;
  color: #2D4A3A;
  text-decoration: none;
  font-weight: 500;
}
.bloglist-edit:hover { color: #1F3528; }
`;
