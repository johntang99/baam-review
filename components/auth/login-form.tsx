"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "./password-input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Treat "/" (the marketing home, e.g. its "Sign in" link sends ?next=/) as
  // "no specific intent" and fall back to the dashboard — a freshly logged-in
  // user wants /app, not to bounce back to the marketing site.
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && rawNext !== "/" ? rawNext : "/app";

  // Pre-fill the email when arriving from the signup form's "already exists"
  // prompt (?email=…), so the user only has to type their password.
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }

    router.push(next);
    router.refresh();
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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-forest hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-sm text-alert" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </Button>

      <p className="text-center text-sm text-text-soft">
        Don&apos;t have an account?{" "}
        <Link
          href={
            // "/" and "/app" both mean "no specific intent" for the
            // signup flow — drop the next so /signup uses its /app
            // default. Anything else is a real return target (e.g.
            // /audit/list) and we keep it.
            next === "/app" || next === "/"
              ? "/signup"
              : `/signup?next=${encodeURIComponent(next)}`
          }
          className="font-medium text-forest hover:underline"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
