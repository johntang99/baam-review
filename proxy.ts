import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Hostname-based routing for the two-domain deployment.
 *
 *   baamreview.com           → public marketing site (this app's root,
 *                              /pricing, /review-value.html)
 *   review.baamplatform.com  → admin app (/app, /login, /signup, /api/*)
 *
 * Both domains point at the same Vercel deployment; this proxy decides which
 * surface the visitor lands on. Runs before updateSession so we don't burn
 * a Supabase call on requests we're about to redirect.
 */
const ADMIN_HOST = "review.baamplatform.com";
const MARKETING_HOST_PRIMARY = "baamreview.com";
const MARKETING_HOST_WWW = "www.baamreview.com";

const MARKETING_ONLY_PATHS = new Set([
  "/",
  "/pricing",
  "/review-value.html",
]);

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const isAdminHost = host === ADMIN_HOST;
  const isMarketingHost =
    host === MARKETING_HOST_PRIMARY || host === MARKETING_HOST_WWW;

  // Admin host hit a marketing-only path: bounce to /app. Auth/redirect is
  // handled there by updateSession on the follow-up request.
  if (isAdminHost && MARKETING_ONLY_PATHS.has(url.pathname)) {
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  // Marketing host hit an admin path: cross-domain redirect so cookies and
  // Supabase sessions live on the admin origin.
  if (isMarketingHost && url.pathname.startsWith("/app")) {
    const adminUrl = new URL(
      url.pathname + url.search,
      `https://${ADMIN_HOST}`,
    );
    return NextResponse.redirect(adminUrl);
  }

  // Everything else (including localhost in dev): fall through to the
  // Supabase session refresh + /app auth gate.
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};
