import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Log in — BAAM Review",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // If the visitor is already signed in, bounce them to ?next= (or /audit/list).
  // Stops "Sign in" links in the marketing nav from rendering a useless form
  // for already-authenticated users.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const params = await searchParams;
    // "/" (marketing home) is not a useful post-login target — default to /app.
    const next =
      params.next?.startsWith("/") && params.next !== "/"
        ? params.next
        : "/app";
    redirect(next);
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your BAAM Review account">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
