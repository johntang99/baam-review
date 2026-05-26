"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Local Supabase client with `detectSessionInUrl: false`. The shared
 * `lib/supabase/client.ts` defaults to PKCE flow + auto-detect, which
 * on this page sees the email link's URL params and tries to call
 * exchangeCodeForSession *before* our handler runs — that fails with
 * "PKCE code verifier not found in storage" because the verifier
 * cookie was never set (server-initiated invite). Disabling auto-detect
 * lets the manual hash/token_hash/code branches below run unimpeded.
 */
function makeCallbackClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        detectSessionInUrl: false,
        flowType: "implicit",
      },
    },
  );
}

type Status = "working" | "error";

export function CallbackClient() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const finish = (path: string) => {
      if (cancelled) return;
      // Replace, not push — the callback URL should not stay in history.
      router.replace(path);
    };

    const fail = (msg: string) => {
      if (cancelled) return;
      setStatus("error");
      setError(msg);
      // Auto-redirect to /login with the error after a short pause so the
      // user can still see what went wrong.
      setTimeout(
        () => router.replace(`/login?error=${encodeURIComponent(msg)}`),
        2500,
      );
    };

    const run = async () => {
      const supabase = makeCallbackClient();
      const url = new URL(window.location.href);
      const next = sanitiseNext(url.searchParams.get("next"));

      // Surface explicit errors from Supabase (expired link, etc.).
      const explicitError =
        url.searchParams.get("error_description") ??
        url.searchParams.get("error_code") ??
        url.searchParams.get("error");
      if (explicitError) {
        fail(explicitError);
        return;
      }

      // 1) Hash fragment (#access_token=…&refresh_token=…) — implicit flow.
      const hash = window.location.hash.replace(/^#/, "");
      if (hash) {
        const hp = new URLSearchParams(hash);
        const accessToken = hp.get("access_token");
        const refreshToken = hp.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setErr) {
            fail(setErr.message);
            return;
          }
          finish(next);
          return;
        }
      }

      // 2) ?token_hash= + ?type= — server-side OTP (custom email template).
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type") as
        | "invite"
        | "recovery"
        | "magiclink"
        | "signup"
        | "email_change"
        | "email"
        | null;
      if (tokenHash && type) {
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          type,
          token_hash: tokenHash,
        });
        if (verifyErr) {
          fail(verifyErr.message);
          return;
        }
        finish(next);
        return;
      }

      // 3) ?code= — PKCE flow (same-browser sign-in / sign-up).
      const code = url.searchParams.get("code");
      if (code) {
        const { error: exErr } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exErr) {
          fail(exErr.message);
          return;
        }
        finish(next);
        return;
      }

      // Nothing actionable — kick to login.
      fail("No auth parameters in the link");
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border-base bg-paper p-8 text-center shadow-sm">
        {status === "working" ? (
          <>
            <Spinner />
            <p className="mt-4 text-[14px] text-text-soft">
              Signing you in…
            </p>
          </>
        ) : (
          <>
            <AlertCircle className="mx-auto h-8 w-8 text-alert" />
            <p className="mt-3 font-display text-[18px] text-ink">
              Couldn&apos;t complete sign-in
            </p>
            <p className="mt-1.5 text-[13px] text-text-soft">
              {error ?? "Unknown error"}
            </p>
            <p className="mt-3 text-[12px] text-text-muted">
              Taking you back to the login page…
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <span
      aria-label="Loading"
      className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-text-muted border-t-forest"
    />
  );
}

function sanitiseNext(raw: string | null): string {
  if (!raw) return "/app";
  if (!raw.startsWith("/")) return "/app";
  return raw;
}
