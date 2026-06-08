import { NextResponse } from "next/server";
import { listBlogSlugs } from "@/lib/blog";
import { listAllCitySlugs } from "@/lib/seo/cities-resolve";

/**
 * Public sitemap served at /sitemap.xml. Manually generated (rather
 * than via Next.js's MetadataRoute convention) so we can include the
 * `<?xml-stylesheet?>` processing instruction that points browsers at
 * /sitemap.xsl — that gives humans a clean, branded view of the
 * sitemap while crawlers continue to read the raw XML.
 *
 * Crawlers (Googlebot, Bingbot) ignore the stylesheet. Browsers apply
 * it and render the XML as a styled HTML table.
 *
 * Anything sitemap-worthy:
 *   - Marketing routes (home, about, case studies, contact, pricing,
 *     audit landing/service, legal/*, start/welcome, book, /zh)
 *   - Blog posts (DB-published, file-fallback)
 *   - City pages (registry + DB-added)
 *
 * Excludes auth-required surfaces (/app, /audit/list, /audit/new),
 * utility endpoints (/api, /login, /signup), per-recipient tracking
 * links (/r, /s, /widget), and dev prototypes — all of which are
 * also disallowed in robots.ts.
 */

export const dynamic = "force-dynamic";
export const revalidate = 3600; // cached for 1h; new blog/city URLs reflect on next hit

const BASE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://baamreview.com"
).trim();

type ChangeFreq =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

interface UrlEntry {
  loc: string;
  lastmod: Date;
  changefreq: ChangeFreq;
  priority: number;
  alternates?: { hreflang: string; href: string }[];
}

interface StaticEntry {
  path: string;
  priority: number;
  changefreq: ChangeFreq;
  zhPath?: string;
}

const STATIC_ENTRIES: StaticEntry[] = [
  { path: "/", priority: 1.0, changefreq: "weekly", zhPath: "/zh" },
  { path: "/about", priority: 0.8, changefreq: "monthly" },
  { path: "/blog", priority: 0.9, changefreq: "daily" },
  { path: "/case-studies", priority: 0.9, changefreq: "weekly" },
  { path: "/contact", priority: 0.6, changefreq: "yearly" },
  { path: "/pricing", priority: 0.9, changefreq: "monthly", zhPath: "/pricing/zh" },
  { path: "/audit", priority: 0.95, changefreq: "weekly" },
  { path: "/audit/service", priority: 0.85, changefreq: "monthly" },
  { path: "/start/how-we-work", priority: 0.7, changefreq: "monthly" },
  { path: "/start/welcome", priority: 0.5, changefreq: "monthly" },
  { path: "/book", priority: 0.6, changefreq: "monthly", zhPath: "/book/zh" },
  { path: "/legal/privacy", priority: 0.3, changefreq: "yearly" },
  { path: "/legal/terms", priority: 0.3, changefreq: "yearly" },
  { path: "/legal/dpa", priority: 0.3, changefreq: "yearly" },
  { path: "/legal/compliance", priority: 0.3, changefreq: "yearly" },
];

export async function GET() {
  const now = new Date();
  const entries: UrlEntry[] = [];

  for (const e of STATIC_ENTRIES) {
    const enUrl = `${BASE_URL}${e.path}`;
    const zhUrl = e.zhPath ? `${BASE_URL}${e.zhPath}` : null;
    entries.push({
      loc: enUrl,
      lastmod: now,
      changefreq: e.changefreq,
      priority: e.priority,
      alternates: zhUrl
        ? [
            { hreflang: "en", href: enUrl },
            { hreflang: "zh", href: zhUrl },
            { hreflang: "x-default", href: enUrl },
          ]
        : undefined,
    });
    if (zhUrl) {
      entries.push({
        loc: zhUrl,
        lastmod: now,
        changefreq: e.changefreq,
        priority: Math.round(e.priority * 0.9 * 100) / 100,
        alternates: [
          { hreflang: "en", href: enUrl },
          { hreflang: "zh", href: zhUrl },
          { hreflang: "x-default", href: enUrl },
        ],
      });
    }
  }

  // Blog posts — DB-first, file fallback.
  for (const post of await listBlogSlugs().catch(() => [])) {
    entries.push({
      loc: `${BASE_URL}/blog/${post.slug}`,
      lastmod: new Date(post.date + "T00:00:00"),
      changefreq: "monthly",
      priority: 0.7,
    });
  }

  // City pages — code registry + DB-added.
  for (const slug of await listAllCitySlugs().catch(() => [])) {
    entries.push({
      loc: `${BASE_URL}/local/${slug}`,
      lastmod: now,
      changefreq: "monthly",
      priority: 0.75,
    });
  }

  const xml = renderSitemapXml(entries);

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

function renderSitemapXml(entries: UrlEntry[]): string {
  const urls = entries.map((e) => {
    const alts =
      e.alternates
        ?.map(
          (a) =>
            `    <xhtml:link rel="alternate" hreflang="${escapeXml(a.hreflang)}" href="${escapeXml(a.href)}"/>`,
        )
        .join("\n") ?? "";
    return [
      "  <url>",
      `    <loc>${escapeXml(e.loc)}</loc>`,
      `    <lastmod>${e.lastmod.toISOString()}</lastmod>`,
      `    <changefreq>${e.changefreq}</changefreq>`,
      `    <priority>${e.priority.toFixed(2)}</priority>`,
      alts,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n");
  });

  // The <?xml-stylesheet?> processing instruction is what lets
  // browsers apply public/sitemap.xsl. Crawlers ignore it and read
  // the raw XML.
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
