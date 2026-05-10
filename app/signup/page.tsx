import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = {
  title: "Sign up — BAAM Review",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Five minutes to your first review request"
    >
      <SignupForm />
    </AuthShell>
  );
}
