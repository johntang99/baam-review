import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  canAccessLocation,
  getInternalContext,
  isFullServiceCustomerReadOnly,
} from "@/lib/auth/staff";
import { buildGmailConsentUrl } from "@/lib/google/gmail-oauth";

const STATE_COOKIE = "g_gmail_oauth_state";
const NEXT_COOKIE = "g_gmail_oauth_next";
const LOCATION_COOKIE = "g_gmail_oauth_location_id";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login?next=/app/send", request.url),
    );
  }

  if (await isFullServiceCustomerReadOnly(supabase, user.id)) {
    return NextResponse.redirect(new URL("/app/billing", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const consentUrl = buildGmailConsentUrl({
    origin: request.nextUrl.origin,
    state,
  });

  const nextRaw = request.nextUrl.searchParams.get("next") ?? "";
  const safeNext =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : "/app/send";
  const locationId = request.nextUrl.searchParams.get("location_id");
  if (!locationId) {
    const errorUrl = new URL(safeNext, request.url);
    errorUrl.searchParams.set("gmail_oauth_error", "location_required");
    return NextResponse.redirect(errorUrl);
  }

  const internal = await getInternalContext(supabase, user.id);
  const allowed = await canAccessLocation(supabase, internal, locationId);
  if (!allowed) {
    const errorUrl = new URL(safeNext, request.url);
    errorUrl.searchParams.set("gmail_oauth_error", "location_forbidden");
    return NextResponse.redirect(errorUrl);
  }

  const response = NextResponse.redirect(consentUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  response.cookies.set(NEXT_COOKIE, safeNext, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  response.cookies.set(LOCATION_COOKIE, locationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
