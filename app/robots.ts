import type { MetadataRoute } from "next";

/**
 * Public robots.txt served at /robots.txt. Next.js auto-generates this
 * from `app/robots.ts`.
 *
 * Policy: allow all crawlers everywhere EXCEPT routes that are:
 *   - per-user authed (the /app dashboard, /audits, /audit/list,
 *     /audit/new, /audit/<id>/{processing,download,embed})
 *   - utility endpoints (auth, API, password reset)
 *   - per-recipient tracking links (/r/<slug>, /s/<token>) — these
 *     leak no PII themselves but indexing them would pollute search
 *     results with thousands of dead links
 *   - development prototypes — they exist behind /prototypes/ and
 *     aren't meant for the public
 *
 * `/audit/<id>` is NOT blocked at the robots level because shared
 * audits (is_public=true) are explicitly meant to be reachable. Google
 * will still respect the per-page `noindex` we set on private audits
 * via metadata (see app/audit/[id]/page.tsx).
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://baamreview.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Authed dashboard surface
          "/app/",
          "/admin/",
          "/audits",
          "/audit/list",
          "/audit/new",

          // Auth + utility
          "/api/",
          "/auth/",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",

          // Per-recipient tracking links — public but not indexable
          "/r/",
          "/s/",
          "/widget/",

          // Internal previews
          "/prototypes/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
