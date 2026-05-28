"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "./password-input";

export function SignupForm({
  preferredPlan,
}: {
  /** Plan the user picked on the marketing page (?plan=self/full). Stored
   * in user_metadata and auto-applied on first dashboard visit so the user
   * doesn't have to re-pick after email confirmation. */
  preferredPlan?: "self_service" | "full_service" | null;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          // Persisted on auth.users so it survives email confirmation
          // and is available on every subsequent login.
          ...(preferredPlan ? { preferred_plan: preferredPlan } : {}),
        },
        emailRedirectTo: `${origin}/auth/callback?next=/app`,
      },
    });

    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }

    setSubmitted(true);
    setPending(false);
  }

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
        <div className="pt-2 text-center text-sm">
          <Link
            href="/login"
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
          onChange={(e) => setEmail(e.target.value)}
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

      {error && (
        <p className="text-sm text-alert" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-text-soft">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-forest hover:underline"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
