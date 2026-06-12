"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "./password-input";

const RESEND_COOLDOWN_SECONDS = 60;

function sanitiseNext(raw: string | null): string {
  if (!raw) return "/app";
  if (!raw.startsWith("/")) return "/app";
  // "/" (marketing home) is never a useful post-signup destination —
  // a brand-new user wants to land in their dashboard, not back on the
  // public landing page. Treat it as "no intent" and default to /app.
  // Other absolute paths (e.g. /audit/list, /audit/new) are honoured so
  // users coming from those flows return to where they started.
  if (raw === "/") return "/app";
  return raw;
}

export function SignupForm({
  preferredPlan,
}: {
  /** Plan the user picked on the marketing page (?plan=self/full). Stored
   * in user_metadata and auto-applied on first dashboard visit so the user
   * doesn't have to re-pick after email confirmation. */
  preferredPlan?: "self_service" | "full_service" | null;
}) {
  const searchParams = useSearchParams();
  const next = sanitiseNext(searchParams.get("next"));

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailExists, setEmailExists] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Resend confirmation email state. Supabase rate-limits resends to ~60s
  // — we surface a countdown so the user knows when they can try again.
  const [resendPending, setResendPending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleResend() {
    setResendError(null);
    setResendPending(true);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setResendPending(false);
    if (err) {
      setResendError(err.message);
      return;
    }
    setResendCount((n) => n + 1);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const origin = window.location.origin;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          // Persisted on auth.users so it survives email confirmation
          // and is available on every subsequent login.
          ...(preferredPlan ? { preferred_plan: preferredPlan } : {}),
        },
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }

    // Supabase obscures existing-email signups for enumeration safety: instead
    // of an error it returns a "success" whose user has an EMPTY identities
    // array (and no session). Treat that as "this email already has an
    // account" and stop here, rather than showing the confirm-email screen
    // for an account that already exists.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setEmailExists(true);
      setError(null);
      setPending(false);
      return;
    }

    setSubmitted(true);
    setPending(false);
  }

  const loginHref =
    next === "/app" ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  if (submitted) {
    return (
      <div className="rounded-xl border border-border-base bg-paper p-6 space-y-4">
        <div className="flex items-center justify-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-forest/10 text-forest">
            <Mail className="h-5 w-5" />
          </span>
        </div>
        <div className="text-center space-y-1.5">
          <h2 className="font-display text-xl text-ink">
            Confirm your email to log in
          </h2>
          <p className="text-sm text-text-soft leading-relaxed">
            We sent a confirmation link to{" "}
            <strong className="text-ink">{email}</strong>.
            <br />
            Open it and click the link to activate your account, then log in.
          </p>
        </div>
        <ul className="space-y-1.5 text-[12.5px] text-text-muted">
          <li>• The email may take a minute to arrive.</li>
          <li>
            • Check your spam / Promotions folder if you don&apos;t see it.
          </li>
          <li>• The link expires after 24 hours.</li>
        </ul>

        <div className="pt-2 text-center text-sm text-text-soft">
          Didn&apos;t receive it?{" "}
          {resendCooldown > 0 ? (
            <span className="text-text-muted">
              Resend available in {resendCooldown}s
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendPending}
              className="font-medium text-forest hover:underline disabled:opacity-60 disabled:cursor-wait"
            >
              {resendPending ? "Sending…" : "Send email again"}
            </button>
          )}
          {resendCount > 0 && resendCooldown > 0 && (
            <span className="ml-1 text-text-muted">· sent ✓</span>
          )}
        </div>
        {resendError && (
          <p className="text-center text-xs text-alert" role="alert">
            {resendError}
          </p>
        )}

        <div className="pt-2 text-center text-sm">
          <Link
            href={loginHref}
            className="font-medium text-forest hover:underline"
          >
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailExists) setEmailExists(false);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-text-muted">At least 8 characters.</p>
      </div>

      {emailExists && (
        <div
          className="rounded-lg border border-alert/30 bg-alert/5 p-3 text-sm text-alert"
          role="alert"
        >
          An account with <strong className="font-medium">{email}</strong>{" "}
          already exists.{" "}
          <Link
            href={
              next === "/app"
                ? `/login?email=${encodeURIComponent(email)}`
                : `/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`
            }
            className="font-medium underline"
          >
            Log in instead
          </Link>{" "}
          or use a different email.
        </div>
      )}

      {error && (
        <p className="text-sm text-alert" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending || emailExists}
      >
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-text-soft">
        Already have an account?{" "}
        <Link
          href={loginHref}
          className="font-medium text-forest hover:underline"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
