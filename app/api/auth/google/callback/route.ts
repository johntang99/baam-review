import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { exchangeCodeForTokens, fetchGoogleUserinfo } from "@/lib/google/oauth";

const STATE_COOKIE = "g_oauth_state";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;

  const error = url.searchParams.get("error");
  if (error) {
    return redirectToConnect(request, `error=${encodeURIComponent(error)}`);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToConnect(request, "error=invalid_state");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login?next=/app/locations", request.url),
    );
  }

  const { data: profile } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return redirectToConnect(request, "error=no_account");
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens({
      code,
      origin: url.origin,
    });
  } catch (e) {
    console.error("Google token exchange failed", e);
    return redirectToConnect(request, "error=token_exchange");
  }

  let googleEmail: string | null = null;
  try {
    const info = await fetchGoogleUserinfo(tokens.access_token);
    googleEmail = info.email;
  } catch (e) {
    console.error("Google userinfo failed (non-fatal)", e);
  }

  // Tokens are keyed per-user (see migration 0032) — each staff member
  // authorizes Google with their own gmail, so the picker / sync / reply
  // path looks up the token by user_id, not account_id.
  const service = createServiceClient();
  const { error: upsertError } = await service
    .from("google_oauth_tokens")
    .upsert(
      {
        user_id: user.id,
        account_id: profile.account_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry: tokens.expiry.toISOString(),
        scope: tokens.scope,
        google_email: googleEmail,
      },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    console.error("Token upsert failed", upsertError);
    return redirectToConnect(request, "error=token_persist");
  }

  const response = NextResponse.redirect(
    new URL("/app/locations/connect/picker", request.url),
  );
  response.cookies.delete(STATE_COOKIE);
  return response;
}

function redirectToConnect(request: NextRequest, query: string) {
  return NextResponse.redirect(
    new URL(`/app/locations?${query}`, request.url),
  );
}
