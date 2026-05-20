import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase auth callback. Email links (signup confirm, password recovery,
 * magic link) land here with `?code=...`. We exchange the code for a
 * session cookie, then redirect to `?next=...` (defaults to /app).
 *
 * Without this route, email links can't establish a session under PKCE
 * (the flow @supabase/ssr uses) and the user gets bounced to /login.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  // Supabase recovery / magic-link errors land here with `error` / `error_code`.
  const errorCode = searchParams.get("error_code");
  if (errorCode) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", errorCode);
    return NextResponse.redirect(url);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Local relative `next` only — don't follow absolute URLs from the param.
      const safeNext = next.startsWith("/") ? next : "/app";
      return NextResponse.redirect(new URL(safeNext, origin));
    }
    const url = new URL("/login", origin);
    url.searchParams.set("error", error.message);
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL("/login", origin));
}
