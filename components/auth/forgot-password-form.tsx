"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const origin = window.location.origin;
    // Always tell Supabase where to redirect after the user clicks the
    // recovery link in their email. That page handles updating the password.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }

    // Always show success — never leak whether the email exists.
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
          <h2 className="font-display text-xl text-ink">Check your inbox</h2>
          <p className="text-sm text-text-soft leading-relaxed">
            If an account exists for{" "}
            <strong className="text-ink">{email}</strong>, we just sent a
            password-reset link there. Open it and click the link to set a
            new password.
          </p>
        </div>
        <ul className="space-y-1.5 text-[12.5px] text-text-muted">
          <li>• The email may take a minute to arrive.</li>
          <li>• Check your spam / Promotions folder if you don&apos;t see it.</li>
          <li>• The link expires after 1 hour.</li>
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

      {error && (
        <p className="text-sm text-alert" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>

      <p className="text-center text-sm text-text-soft">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-forest hover:underline"
        >
          Back to log in
        </Link>
      </p>
    </form>
  );
}
