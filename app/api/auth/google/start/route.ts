import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { isFullServiceCustomerReadOnly } from "@/lib/auth/staff";
import { buildConsentUrl } from "@/lib/google/oauth";

const STATE_COOKIE = "g_oauth_state";
const NEXT_COOKIE = "g_oauth_next";

/**
 * Initiate the per-user Google OAuth flow.
 *
 * Optional `?next=<relative path>` query param lets callers specify where
 * to return the user after consent — important for the Start-Now /
 * Onboarding-queue flow where the picker URL carries a customer_record
 * id that must survive the OAuth roundtrip. Without this, the callback
 * always lands on /app/locations/connect/picker and the customer_record
 * param is lost.
 *
 * Security: only relative paths starting with '/' (but not '//') are
 * honored. Anything else falls back to the default picker URL.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login?next=/app/locations", request.url),
    );
  }

  // Full Service customers don't connect their own GBP — BAAM staff does
  // it on their behalf. Bounce them to billing where they can see the
  // trial status and the next-step message.
  if (await isFullServiceCustomerReadOnly(supabase, user.id)) {
    return NextResponse.redirect(new URL("/app/billing", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const consentUrl = buildConsentUrl({
    origin: request.nextUrl.origin,
    state,
  });

  // Validate ?next= — must be a clean relative path so this can't be
  // turned into an open-redirect vector.
  const nextRaw = request.nextUrl.searchParams.get("next") ?? "";
  const safeNext =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "";

  const response = NextResponse.redirect(consentUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  if (safeNext) {
    response.cookies.set(NEXT_COOKIE, safeNext, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
  }
  return response;
}
