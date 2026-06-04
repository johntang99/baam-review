import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side auth callback. Handles the two flavours Supabase delivers
 * in the query string:
 *
 *   • ?code=…             — PKCE (sign-up / sign-in / magic-link)
 *   • ?token_hash=&type=  — server-side OTP (custom email template)
 *
 * Client-side handling was hitting "PKCE code verifier not found in
 * storage" — the verifier cookie set by the signup call wasn't being
 * found from a fresh browser client instance after the redirect. Running
 * the exchange on the server through @supabase/ssr's createServerClient
 * reads the same cookies the browser client wrote, so the verifier is
 * found and a session is established before the user ever sees the page.
 *
 * The implicit flow (#access_token=…&refresh_token=…) can't be handled
 * server-side — the URL fragment never reaches the server — so we fall
 * through to the existing client page for that case.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = sanitiseNext(searchParams.get("next"));

  const explicitError =
    searchParams.get("error_description") ??
    searchParams.get("error_code") ??
    searchParams.get("error");
  if (explicitError) {
    return failRedirect(origin, explicitError);
  }

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as
    | "invite"
    | "recovery"
    | "magiclink"
    | "signup"
    | "email_change"
    | "email"
    | null;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return failRedirect(origin, error.message);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      return failRedirect(origin, error.message);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  // No actionable params and no hash flow currently in use — just send
  // the user back to /login. If we ever issue server-side invites or
  // recovery emails that use the implicit `#access_token=…` format we'll
  // need to bring the /auth/callback/hash client page back into play.
  return NextResponse.redirect(`${origin}/login`);
}

function sanitiseNext(raw: string | null): string {
  if (!raw) return "/app";
  if (!raw.startsWith("/")) return "/app";
  return raw;
}

function failRedirect(origin: string, msg: string) {
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(msg)}`,
  );
}
