import type { MetadataRoute } from "next";
import { listBlogSlugs } from "@/lib/blog";
import { listAllCitySlugs } from "@/lib/seo/cities-resolve";

/**
 * Public sitemap served at /sitemap.xml. Next.js auto-discovers this
 * file (`app/sitemap.ts`) and generates the XML at request time.
 *
 * Hard rules:
 *   1. Only include pages a stranger should see. Anything under /app
 *      (the authed dashboard), /api, /auth, /login, /signup, /r,
 *      /s, /widget, /prototypes is excluded — those routes either
 *      require sign-in, are utility endpoints, or are per-user
 *      tracking links.
 *   2. Bilingual pages get both EN and ZH entries with alternates so
 *      Google understands they're the same content in two languages.
 *   3. `lastModified` defaults to "now" for evergreen marketing pages.
 *      Blog posts and city pages should override this with their
 *      actual publish/update time once that infrastructure ships.
 *
 * As blog/city/industry/research routes come online (Days 3-5 of the
 * SEO_GEO implementation plan), each new template should append its
 * generated URLs here — see comments at the bottom for the wiring
 * pattern.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://baamreview.com";

interface StaticEntry {
  /** Path beginning with "/" — joined to BASE_URL at generation time. */
  path: string;
  /** SEO importance hint to crawlers. Defaults vary by page kind. */
  priority: number;
  /** Crawl-frequency hint. Most marketing pages are weekly/monthly. */
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  /** Optional ZH equivalent path — when set, both URLs get `alternates`. */
  zhPath?: string;
}

const STATIC_ENTRIES: StaticEntry[] = [
  // Top-of-funnel marketing
  { path: "/", priority: 1.0, changeFrequency: "weekly", zhPath: "/zh" },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.9, changeFrequency: "daily" },
  { path: "/case-studies", priority: 0.9, changeFrequency: "weekly" },
  { path: "/contact", priority: 0.6, changeFrequency: "yearly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly", zhPath: "/pricing/zh" },

  // Audit funnel — the primary lead magnet
  { path: "/audit", priority: 0.95, changeFrequency: "weekly" },
  { path: "/audit/service", priority: 0.85, changeFrequency: "monthly" },

  // Discovery / education routes shipped before the blog goes live
  { path: "/start/how-we-work", priority: 0.7, changeFrequency: "monthly" },
  { path: "/start/welcome", priority: 0.5, changeFrequency: "monthly" },
  { path: "/book", priority: 0.6, changeFrequency: "monthly", zhPath: "/book/zh" },

  // Legal — low priority but required for E-E-A-T signal
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/dpa", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/compliance", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const e of STATIC_ENTRIES) {
    const enUrl = `${BASE_URL}${e.path}`;
    const zhUrl = e.zhPath ? `${BASE_URL}${e.zhPath}` : null;

    entries.push({
      url: enUrl,
      lastModified: now,
      changeFrequency: e.changeFrequency,
      priority: e.priority,
      ...(zhUrl
        ? {
            alternates: {
              languages: { en: enUrl, zh: zhUrl },
            },
          }
        : {}),
    });

    if (zhUrl) {
      entries.push({
        url: zhUrl,
        lastModified: now,
        changeFrequency: e.changeFrequency,
        priority: e.priority * 0.9, // ZH variant slightly lower (smaller audience for now)
        alternates: { languages: { en: enUrl, zh: zhUrl } },
      });
    }
  }

  // Blog posts — read from DB (with content/blog/*.md fallback).
  // `lastModified` uses the post's `updated` date if set, falling
  // back to `date`.
  for (const post of await listBlogSlugs()) {
    entries.push({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.date + "T00:00:00"),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  // City pages — code registry (lib/seo/cities.ts) plus any
  // DB-added cities that have been published via /admin/cities.
  for (const slug of await listAllCitySlugs()) {
    entries.push({
      url: `${BASE_URL}/local/${slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.75,
    });
  }

  // TODO (Day 5+): same for app/industries/[vertical] and
  // app/research/[slug].

  return entries;
}
