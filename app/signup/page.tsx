import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = {
  title: "Sign up — BAAM Review",
};

export const dynamic = "force-dynamic";

const VALID_PLAN_SHORT: Record<string, "self_service" | "full_service"> = {
  self: "self_service",
  full: "full_service",
  self_service: "self_service",
  full_service: "full_service",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; next?: string }>;
}) {
  const params = await searchParams;

  // Already-signed-in visitors clicking a `/signup?next=...` link should go
  // straight to `next` instead of seeing the signup form again. Mirrors the
  // /login behaviour. Same restriction: only relative paths accepted.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const next = params.next?.startsWith("/") ? params.next : "/audit/list";
    redirect(next);
  }

  // Validate and normalize. Marketing CTAs use ?plan=self; accept the
  // canonical names too in case anyone shares a deep link.
  const preferredPlan = params.plan
    ? (VALID_PLAN_SHORT[params.plan] ?? null)
    : null;

  return (
    <AuthShell title="Create your account">
      <SignupForm preferredPlan={preferredPlan} />
    </AuthShell>
  );
}
