import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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
  const preferredPlan = params.plan
    ? (VALID_PLAN_SHORT[params.plan] ?? null)
    : null;

  // Already-signed-in visitors clicking a /signup link should skip the
  // form. Two sub-cases:
  //   (a) Marketing pricing CTA — has ?plan=... — apply the plan choice
  //       (if not already set) and drop them on /app/billing where they
  //       can actually start the trial.
  //   (b) Anything else — honour ?next= if relative, otherwise default
  //       to /app (the Review dashboard). Audit pages always pass an
  //       explicit ?next=/audit/... so they're not affected.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    if (preferredPlan) {
      const { data: profile } = await supabase
        .from("users")
        .select("account_id")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile?.account_id) {
        const { data: acct } = await supabase
          .from("accounts")
          .select("review_plan")
          .eq("id", profile.account_id)
          .maybeSingle();
        // Always honour the user's latest pick. Clicking "Start Full
        // Service trial" after previously choosing Self-Serve is an
        // explicit switch intent — the dashboard plan label, onboarding
        // bar variant, and billing-page UI all read review_plan, so
        // failing to update here leaves them on the wrong journey.
        // Stripe subscriptions live on their own table and aren't
        // affected by this column.
        if (acct?.review_plan !== preferredPlan) {
          const svc = createServiceClient();
          await svc
            .from("accounts")
            .update({ review_plan: preferredPlan })
            .eq("id", profile.account_id);
        }
      }
      // Full Service starts with billing (Step 1 of their bar). Self-Serve
      // starts with GBP connect (Step 1 of theirs) — land on the dashboard
      // so the bar's "Connect Google Business Profile →" CTA is the first
      // thing they see.
      redirect(
        preferredPlan === "full_service" ? "/app/billing" : "/app",
      );
    }
    const next = params.next?.startsWith("/") ? params.next : "/app";
    redirect(next);
  }

  return (
    <AuthShell title="Create your account">
      <SignupForm preferredPlan={preferredPlan} />
    </AuthShell>
  );
}
