import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { buildConsentUrl } from "@/lib/google/oauth";

const STATE_COOKIE = "g_oauth_state";

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

  const state = randomBytes(24).toString("base64url");
  const consentUrl = buildConsentUrl({
    origin: request.nextUrl.origin,
    state,
  });

  const response = NextResponse.redirect(consentUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
