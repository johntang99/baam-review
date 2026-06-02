import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Hostname normalization.
 *
 *   baamreview.com           → canonical host, serves everything
 *                              (marketing, audit app, review platform admin)
 *   review.baamplatform.com  → 308 → baamreview.com (legacy subdomain)
 *
 * The www ↔ root redirect is owned by Vercel's domain config (set
 * `www.baamreview.com` to redirect to `baamreview.com` in the Vercel
 * dashboard). Doing it here too creates a loop when Vercel's setting
 * happens to point the opposite direction.
 *
 * 308 (Permanent Redirect) preserves method and body, so POST/PUT/API
 * requests survive the redirect.
 */
const CANONICAL_HOST = "baamreview.com";
const LEGACY_HOSTS = new Set<string>(["review.baamplatform.com"]);

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = (request.headers.get("host") ?? "").toLowerCase();

  if (LEGACY_HOSTS.has(host)) {
    const target = new URL(
      url.pathname + url.search,
      `https://${CANONICAL_HOST}`,
    );
    return NextResponse.redirect(target, { status: 308 });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};
