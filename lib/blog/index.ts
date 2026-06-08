import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  listPublishedContent,
  getPublishedContent,
  type ContentItem,
} from "@/lib/admin/content";

/**
 * Blog data layer. Reads markdown files from /content/blog/, parses a
 * minimal frontmatter block at the top of each, and exposes typed
 * helpers the App Router pages use.
 *
 * Frontmatter syntax — YAML-ish but parsed by hand so we don't need a
 * dep. Keys we recognize:
 *
 *   ---
 *   title: "5 review request email templates"
 *   description: "Templates that hit a 30% reply rate, with the why behind each."
 *   slug: "5-review-request-email-templates"   # optional, defaults to filename
 *   date: 2026-06-10                            # required, YYYY-MM-DD
 *   updated: 2026-06-20                         # optional
 *   author: "Jane Doe"
 *   authorUrl: "https://baamreview.com/about"   # optional
 *   keywords: [reviews, google, email templates]
 *   image: "/og/5-templates.png"                # optional 1200x630
 *   draft: false                                # set true to exclude
 *   ---
 *
 *   # H1 — body markdown starts here.
 *
 * Anything between `---` lines at the top is frontmatter. Anything
 * after is the post body, rendered by react-markdown on the page.
 *
 * Files prefixed with "_" are templates and never published (so
 * `content/blog/_template.md` won't appear in the index or sitemap).
 */

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  author: string;
  authorUrl?: string;
  keywords: string[];
  image?: string;
  draft: boolean;
  body: string;
}

export interface BlogPostSummary
  extends Omit<BlogPost, "body"> {
  /** First ~180 chars of body, stripped of markdown, for index card text. */
  excerpt: string;
}

/** Parse a single markdown file → BlogPost. */
function parsePost(filePath: string): BlogPost | null {
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) {
    console.warn(`[blog] ${filePath} has no frontmatter — skipping.`);
    return null;
  }
  const [, frontmatterBlock, body] = match;
  const fm = parseFrontmatter(frontmatterBlock);

  const filenameSlug = path.basename(filePath, path.extname(filePath));
  const slug = (fm.slug as string) || filenameSlug;

  // Required fields. Bail loudly if missing so author sees the error.
  const title = (fm.title as string) || "";
  const description = (fm.description as string) || "";
  const date = (fm.date as string) || "";
  if (!title || !description || !date) {
    console.warn(
      `[blog] ${filePath} missing required frontmatter (title/description/date) — skipping.`,
    );
    return null;
  }

  return {
    slug,
    title,
    description,
    date,
    updated: (fm.updated as string) || undefined,
    author: (fm.author as string) || "BAAM Review Team",
    authorUrl: (fm.authorUrl as string) || undefined,
    keywords: Array.isArray(fm.keywords)
      ? (fm.keywords as string[])
      : typeof fm.keywords === "string"
        ? (fm.keywords as string).split(",").map((s) => s.trim())
        : [],
    image: (fm.image as string) || undefined,
    draft: fm.draft === true || fm.draft === "true",
    body: body.trim(),
  };
}

/** Very small YAML-ish frontmatter parser. Handles strings, arrays in
 * `[a, b]` form, booleans, and dates. Reaches for full YAML would
 * require a dep — not worth it for our 7-field shape. */
function parseFrontmatter(block: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value: string = line.slice(idx + 1).trim();

    // Strip surrounding quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Array form: [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1).trim();
      out[key] = inner
        ? inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""))
        : [];
      continue;
    }

    // Boolean coercion.
    if (value === "true") {
      out[key] = true;
      continue;
    }
    if (value === "false") {
      out[key] = false;
      continue;
    }

    out[key] = value;
  }
  return out;
}

/** Strip markdown formatting (headings, links, emphasis) for an
 * excerpt that reads naturally on index cards. Aggressive but
 * pragmatic — we don't need perfect parsing here. */
function stripMarkdown(md: string, maxLen = 180): string {
  const cleaned = md
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links → text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "") // images → removed
    .replace(/`{3}[\s\S]*?`{3}/g, "") // code fences
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1") // bold/italic
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1") // _italic_
    .replace(/^>\s+/gm, "") // blockquotes
    .replace(/^\s*[-*+]\s+/gm, "") // bullets
    .replace(/^\s*\d+\.\s+/gm, "") // numbered lists
    .replace(/\n+/g, " ") // collapse newlines
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > maxLen
    ? cleaned.slice(0, maxLen).replace(/\s+\S*$/, "") + "…"
    : cleaned;
}

/** List all FILE-SYSTEM-backed published posts. Used as a fallback /
 *  union source so editors can still drop markdown files during the
 *  transition to DB-driven content. */
function listFsPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const files = fs.readdirSync(BLOG_DIR);
  const posts: BlogPost[] = [];
  for (const file of files) {
    if (file.startsWith("_") || file.startsWith(".")) continue;
    if (!file.endsWith(".md") && !file.endsWith(".mdx")) continue;
    const post = parsePost(path.join(BLOG_DIR, file));
    if (!post || post.draft) continue;
    posts.push(post);
  }
  return posts;
}

/** Convert a DB ContentItem row into the BlogPost shape used by the
 *  renderer. Mirrors the file-system frontmatter parser. */
function itemToBlogPost(item: ContentItem): BlogPost {
  const fm = item.frontmatter;
  const keywords = Array.isArray(fm.keywords)
    ? (fm.keywords as string[])
    : typeof fm.keywords === "string"
      ? (fm.keywords as string).split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  return {
    slug: item.slug,
    title: (fm.title as string) ?? "",
    description: (fm.description as string) ?? "",
    date: (fm.date as string) ?? item.published_at?.slice(0, 10) ?? "",
    updated: (fm.updated as string) ?? undefined,
    author: (fm.author as string) ?? "BAAM Review Team",
    authorUrl: (fm.authorUrl as string) ?? undefined,
    keywords,
    image: (fm.image as string) ?? undefined,
    draft: false,
    body: item.body,
  };
}

/** List all published posts, sorted newest first. DB is authoritative;
 *  filesystem posts are merged in only for slugs not already in DB. */
export async function listBlogPosts(): Promise<BlogPostSummary[]> {
  const dbItems = await listPublishedContent("blog_post").catch((e) => {
    console.warn("[blog] listPublishedContent failed:", e);
    return [];
  });
  const dbPosts = dbItems.map(itemToBlogPost);
  const dbSlugs = new Set(dbPosts.map((p) => p.slug));

  const fsPosts = listFsPosts().filter((p) => !dbSlugs.has(p.slug));

  const merged = [...dbPosts, ...fsPosts];
  merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return merged.map((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
    date: p.date,
    updated: p.updated,
    author: p.author,
    authorUrl: p.authorUrl,
    keywords: p.keywords,
    image: p.image,
    draft: p.draft,
    excerpt: stripMarkdown(p.body),
  }));
}

/** Read one post by slug. DB-first, then filesystem fallback. */
export async function readBlogPost(slug: string): Promise<BlogPost | null> {
  const dbItem = await getPublishedContent("blog_post", slug, "en").catch(
    (e) => {
      console.warn("[blog] getPublishedContent failed:", e);
      return null;
    },
  );
  if (dbItem) return itemToBlogPost(dbItem);

  for (const post of listFsPosts()) {
    if (post.slug === slug) return post;
  }
  return null;
}

/** List published slugs + last-modified date. Used by sitemap. */
export async function listBlogSlugs(): Promise<
  { slug: string; date: string }[]
> {
  const summaries = await listBlogPosts();
  return summaries.map((p) => ({ slug: p.slug, date: p.updated ?? p.date }));
}
