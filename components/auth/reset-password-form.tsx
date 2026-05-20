"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "./password-input";

/**
 * Set a new password after clicking a password-reset link from email.
 * Supabase exchanges the link's code for a session via the auth-callback
 * route automatically — by the time the user lands here they're signed
 * in with a temporary "recovery" session and can call updateUser.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }
    setDone(true);
    setPending(false);
    setTimeout(() => {
      router.push("/app");
      router.refresh();
    }, 1200);
  }

  if (hasSession === null) {
    return (
      <p className="text-sm text-text-soft text-center">Loading…</p>
    );
  }

  if (!hasSession) {
    return (
      <div className="rounded-xl border border-border-base bg-paper p-6 text-center space-y-3">
        <h2 className="font-display text-xl text-ink">Link expired</h2>
        <p className="text-sm text-text-soft leading-relaxed">
          This reset link is no longer valid. Reset links expire after 1 hour
          and can only be used once.
        </p>
        <div className="pt-1 text-sm">
          <Link
            href="/forgot-password"
            className="font-medium text-forest hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl border border-forest/30 bg-forest/5 p-6 text-center space-y-1.5">
        <h2 className="font-display text-xl text-ink">Password updated</h2>
        <p className="text-sm text-text-soft">
          Taking you to your dashboard…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
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

      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm new password</Label>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-sm text-alert" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}
