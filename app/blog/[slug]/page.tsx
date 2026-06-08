import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { listBlogPosts, readBlogPost } from "@/lib/blog";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  articleSchema,
  breadcrumbSchema,
  faqPageSchema,
  type FaqItem,
} from "@/lib/seo/schemas";
import { BlogShell } from "../blog-shell";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://baamreview.com";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/** Build per-slug metadata so each post gets its own title/description/og. */
export async function generateMetadata(
  { params }: RouteParams,
): Promise<Metadata> {
  const { slug } = await params;
  const post = await readBlogPost(slug);
  if (!post) return { title: "Not found — BAAM Review" };

  const url = `${BASE_URL}/blog/${post.slug}`;
  return {
    title: `${post.title} — BAAM Review`,
    description: post.description,
    keywords: post.keywords.length > 0 ? post.keywords : undefined,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      authors: [post.author],
      images: post.image ? [{ url: post.image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: post.image ? [post.image] : undefined,
    },
  };
}

/** Pre-render every published post at build time. */
export async function generateStaticParams() {
  const posts = await listBlogPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export const dynamic = "force-static";

export default async function BlogPostPage({ params }: RouteParams) {
  const { slug } = await params;
  const post = await readBlogPost(slug);
  if (!post) notFound();

  const url = `${BASE_URL}/blog/${post.slug}`;
  const { body, faq } = extractFaq(post.body);

  // Schema bundle: Article + Breadcrumb + optional FAQPage. Crawlers
  // and AI search are most aggressive about scraping FAQ blocks — so
  // posts that include them get materially better citation rates.
  const schemaEntities: Record<string, unknown>[] = [
    articleSchema({
      path: `/blog/${post.slug}`,
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.updated,
      authorName: post.author,
      authorUrl: post.authorUrl,
      imageUrl: post.image
        ? post.image.startsWith("http")
          ? post.image
          : `${BASE_URL}${post.image}`
        : undefined,
      keywords: post.keywords,
    }),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: post.title, path: `/blog/${post.slug}` },
    ]),
  ];
  if (faq.length > 0) {
    schemaEntities.push(
      faqPageSchema({ path: `/blog/${post.slug}`, items: faq }),
    );
  }

  return (
    <>
      <JsonLd data={schemaEntities} />

      <BlogShell active="post">
        <article>
          <div className="blog-post-meta">
            <span>{formatDate(post.date)}</span>
            {post.updated && post.updated !== post.date && (
              <>
                <span className="sep">·</span>
                <span>Updated {formatDate(post.updated)}</span>
              </>
            )}
            <span className="sep">·</span>
            <span>{post.author}</span>
            {post.keywords.length > 0 && (
              <>
                <span className="sep">·</span>
                <span>{post.keywords[0]}</span>
              </>
            )}
          </div>

          <h1 className="blog-post-title">{post.title}</h1>
          <p className="blog-post-deck">{post.description}</p>

          <div className="blog-post-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
          </div>

          {faq.length > 0 && (
            <section className="blog-faq" aria-label="Frequently asked questions">
              <h2>Frequently asked questions</h2>
              {faq.map((item, i) => (
                <div key={i} className="blog-faq-item">
                  <p className="blog-faq-q">{item.question}</p>
                  <p className="blog-faq-a">{item.answer}</p>
                </div>
              ))}
            </section>
          )}

          <div className="blog-cta">
            <p className="blog-cta-text">
              Want to see what this looks like for <em>your business?</em>
            </p>
            <Link href="/audit/" className="blog-cta-btn">
              Get a free audit →
            </Link>
          </div>
        </article>
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

/**
 * Extract a trailing FAQ section from the markdown body. We treat any
 * level-2 heading whose text is exactly "FAQ", "FAQs", or "Frequently
 * asked questions" (case-insensitive) as the start of the FAQ block.
 * Inside, alternating level-3 headings + their following paragraph
 * become Question/Answer pairs that feed `FAQPage` schema AND the
 * visible FAQ block at the bottom of the page.
 *
 * This means authors get FAQ schema for free just by adding a normal
 * H2 + H3-based FAQ section at the bottom of any post. No special
 * frontmatter or component import required.
 */
function extractFaq(markdown: string): { body: string; faq: FaqItem[] } {
  const faqHeadingRe = /^##\s+(?:FAQ|FAQs|Frequently\s+asked\s+questions)\s*$/im;
  const match = markdown.match(faqHeadingRe);
  if (!match || match.index === undefined) {
    return { body: markdown, faq: [] };
  }

  const body = markdown.slice(0, match.index).trim();
  const faqBlock = markdown.slice(match.index + match[0].length).trim();

  const faq: FaqItem[] = [];
  // Split on level-3 headings; each chunk is one Q/A pair.
  const parts = faqBlock.split(/^###\s+/m).filter((p) => p.trim());
  for (const part of parts) {
    const [firstLine, ...rest] = part.split(/\r?\n/);
    const question = firstLine.trim();
    const answer = rest.join("\n").trim();
    if (question && answer) {
      faq.push({ question, answer });
    }
  }

  return { body, faq };
}
