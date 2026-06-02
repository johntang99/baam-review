import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Hostname normalization for the single-domain deployment.
 *
 *   baamreview.com           → canonical host, serves everything
 *                              (marketing, audit app, review platform admin)
 *   www.baamreview.com       → 308 → baamreview.com
 *   review.baamplatform.com  → 308 → baamreview.com (legacy subdomain)
 *
 * 308 (Permanent Redirect) preserves method and body, so POST/PUT/API
 * requests survive the redirect — important for any client still calling
 * the old origin during the transition.
 *
 * Localhost and Vercel preview URLs fall through to updateSession
 * (Supabase session refresh) without redirect.
 */
const CANONICAL_HOST = "baamreview.com";
const LEGACY_HOSTS = new Set<string>([
  "www.baamreview.com",
  "review.baamplatform.com",
]);

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
