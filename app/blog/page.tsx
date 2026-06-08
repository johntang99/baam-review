import type { Metadata } from "next";
import Link from "next/link";
import { listBlogPosts } from "@/lib/blog";
import { JsonLd } from "@/components/seo/JsonLd";
import { collectionPageSchema } from "@/lib/seo/schemas";
import { BlogShell } from "./blog-shell";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://baamreview.com";

export const metadata: Metadata = {
  title: "Blog — BAAM Review",
  description:
    "Research, playbooks, and case studies from BAAM Review. Honest data on local search, AI search, and what actually moves Google reviews.",
  alternates: { canonical: `${BASE_URL}/blog` },
};

export const dynamic = "force-static";
// Re-read posts on every request when running in dev — keeps the index
// in sync with file changes without a restart. In prod (force-static
// above), Next.js caches at build time which is what we want.

export default async function BlogIndexPage() {
  const posts = await listBlogPosts();

  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          path: "/blog",
          name: "BAAM Review Blog",
          description:
            "Research, playbooks, and case studies for local-business review marketing.",
        })}
      />

      <BlogShell active="index">
        <header className="blog-hero">
          <p className="blog-eyebrow">Blog · Research &amp; playbooks</p>
          <h1 className="blog-h1">
            Honest data on <em>local search</em>, reviews, and what works.
          </h1>
          <p className="blog-deck">
            We run thousands of audits — these are the patterns we see, the
            data behind them, and the playbooks our clients use.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="blog-empty">
            No posts yet — check back soon. (If you&apos;re the editor,
            drop a markdown file into <code>content/blog/</code> and it
            will show up here.)
          </p>
        ) : (
          <ul className="blog-list">
            {posts.map((p) => (
              <li key={p.slug} className="blog-card">
                <Link href={`/blog/${p.slug}`} className="blog-card-link">
                  <p className="blog-card-date">
                    {formatDate(p.date)}
                    {p.keywords.length > 0 && (
                      <>
                        <span className="blog-card-sep">·</span>
                        <span className="blog-card-tag">{p.keywords[0]}</span>
                      </>
                    )}
                  </p>
                  <h2 className="blog-card-title">{p.title}</h2>
                  <p className="blog-card-excerpt">
                    {p.description || p.excerpt}
                  </p>
                  <span className="blog-card-cta">Read →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </BlogShell>
    </>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
