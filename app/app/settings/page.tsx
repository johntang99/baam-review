import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getInternalContext } from "@/lib/auth/staff";
import { PageHeader } from "@/components/admin/page-header";
import { Section } from "@/components/ui/section";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = {
  title: "Settings — BAAM Review",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/settings");

  const { data: profile } = await supabase
    .from("users")
    .select("account_id, full_name, ops_role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.account_id) redirect("/app");

  const { data: account } = await supabase
    .from("accounts")
    .select("name, subscription_tier")
    .eq("id", profile.account_id)
    .maybeSingle();

  const internal = await getInternalContext(supabase, user.id);
  const roleLabel = internal?.opsRole
    ? internal.opsRole === "account_manager"
      ? "Account manager"
      : internal.opsRole.charAt(0).toUpperCase() + internal.opsRole.slice(1)
    : null;

  return (
    <main className="px-10 py-10">
      <div className="max-w-3xl space-y-2">
        <PageHeader
          eyebrow="Settings"
          title="Account"
          description={`Signed in as ${user.email}`}
        />

        <div className="pt-6">
          <Section
            title="Your profile"
            description="Your login info. Contact an admin to change your name or role."
          >
            <dl className="grid grid-cols-[160px_1fr] gap-y-3 text-[13.5px]">
              <dt className="text-text-soft">Your email</dt>
              <dd className="text-ink">{user.email}</dd>
              <dt className="text-text-soft">Your name</dt>
              <dd className="text-ink">{profile.full_name ?? "—"}</dd>
              {roleLabel && (
                <>
                  <dt className="text-text-soft">Role</dt>
                  <dd className="text-ink">{roleLabel}</dd>
                </>
              )}
              <dt className="text-text-soft">Workspace</dt>
              <dd className="text-ink">{account?.name ?? "—"}</dd>
              <dt className="text-text-soft">Plan</dt>
              <dd className="text-ink capitalize">
                {account?.subscription_tier ?? "—"}
              </dd>
            </dl>
          </Section>

          <Section
            title="Change password"
            description="Set a new password for your login. Takes effect immediately."
          >
            <ChangePasswordForm />
          </Section>

          <Section
            title="Email sender"
            description="Each location can send review-request emails from its own domain. Configure that per location."
          >
            <Link
              href="/app/locations"
              className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-forest hover:underline"
            >
              Configure per-location senders
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Section>

          <Section
            title="Sign out"
            description="End your session on this device. You'll need your password to sign back in."
          >
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md border border-alert/40 bg-alert/[0.04] px-3 py-2 text-[13.5px] font-medium text-alert hover:bg-alert/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out of {user.email}
              </button>
            </form>
          </Section>
        </div>
      </div>
    </main>
  );
}
