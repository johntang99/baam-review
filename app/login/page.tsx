import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Log in — BAAM Review",
};

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Log in to your BAAM Review account">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
