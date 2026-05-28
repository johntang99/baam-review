import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = {
  title: "Sign up — BAAM Review",
};

const VALID_PLAN_SHORT: Record<string, "self_service" | "full_service"> = {
  self: "self_service",
  full: "full_service",
  self_service: "self_service",
  full_service: "full_service",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  // Validate and normalize. Marketing CTAs use ?plan=self; accept the
  // canonical names too in case anyone shares a deep link.
  const preferredPlan = params.plan
    ? (VALID_PLAN_SHORT[params.plan] ?? null)
    : null;

  return (
    <AuthShell
      title="Create your account"
      subtitle="Five minutes to your first review request"
    >
      <SignupForm preferredPlan={preferredPlan} />
    </AuthShell>
  );
}
