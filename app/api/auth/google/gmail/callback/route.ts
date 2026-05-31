import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  exchangeGmailCodeForTokens,
  fetchGmailUserinfo,
} from "@/lib/google/gmail-oauth";
import { canAccessLocation, getInternalContext } from "@/lib/auth/staff";

const STATE_COOKIE = "g_gmail_oauth_state";
const NEXT_COOKIE = "g_gmail_oauth_next";
const LOCATION_COOKIE = "g_gmail_oauth_location_id";

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const nextPath = request.cookies.get(NEXT_COOKIE)?.value || "/app/send";
  const locationId = request.cookies.get(LOCATION_COOKIE)?.value ?? null;

  const cleanRedirect = (
    path: string,
    opts?: { errorCode?: string; oauthState?: "connected" },
  ) => {
    const url = new URL(path, request.url);
    if (opts?.errorCode) {
      url.searchParams.set("gmail_oauth_error", opts.errorCode);
    }
    if (opts?.oauthState) {
      url.searchParams.set("gmail_oauth", opts.oauthState);
    }
    const res = NextResponse.redirect(url);
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(NEXT_COOKIE);
    res.cookies.delete(LOCATION_COOKIE);
    return res;
  };

  if (error) {
    return cleanRedirect(nextPath, { errorCode: "consent_denied" });
  }

  if (!state || !expectedState || state !== expectedState || !code) {
    return cleanRedirect(nextPath, { errorCode: "invalid_state" });
  }
  if (!locationId) {
    return cleanRedirect(nextPath, { errorCode: "location_required" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return cleanRedirect("/login?next=/app/send", { errorCode: "no_user" });
  }
  const internal = await getInternalContext(supabase, user.id);
  const allowed = await canAccessLocation(supabase, internal, locationId);
  if (!allowed) {
    return cleanRedirect(nextPath, { errorCode: "location_forbidden" });
  }

  let tokens;
  try {
    tokens = await exchangeGmailCodeForTokens({
      code,
      origin: request.nextUrl.origin,
    });
  } catch {
    return cleanRedirect(nextPath, { errorCode: "token_exchange_failed" });
  }
  let googleEmail: string | null = null;
  try {
    const info = await fetchGmailUserinfo(tokens.access_token);
    googleEmail = info.email ?? null;
  } catch {
    // Non-fatal for token storage.
  }
  if (!googleEmail && tokens.id_token) {
    googleEmail = extractEmailFromIdToken(tokens.id_token);
  }

  const service = createServiceClient();
  const { data: meRow, error: meError } = await service
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single();

  if (meError || !meRow) {
    return cleanRedirect(nextPath, { errorCode: "account_lookup_failed" });
  }

  const { error: upsertError } = await service
    .from("gmail_oauth_tokens")
    .upsert(
      {
        user_id: user.id,
        location_id: locationId,
        account_id: meRow.account_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry: tokens.expiry.toISOString(),
        scope: tokens.scope,
        google_email: googleEmail,
      },
      {
        onConflict: "location_id",
      },
    );

  if (upsertError) {
    return cleanRedirect(nextPath, { errorCode: "token_store_failed" });
  }

  const done = cleanRedirect(nextPath, { oauthState: "connected" });
  done.cookies.set("gmail_oauth_connected", "1", {
    path: "/",
    maxAge: 15,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return done;
}

function extractEmailFromIdToken(idToken: string): string | null {
  try {
    const parts = idToken.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { email?: string };
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}
