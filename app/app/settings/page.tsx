import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { Section } from "@/components/ui/section";

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
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.account_id) redirect("/app");

  const { data: account } = await supabase
    .from("accounts")
    .select("name, primary_email, subscription_tier")
    .eq("id", profile.account_id)
    .maybeSingle();

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
            title="Account"
            description="Read-only for v1. Contact support to update."
          >
            <dl className="grid grid-cols-[160px_1fr] gap-y-3 text-[13.5px]">
              <dt className="text-text-soft">Account name</dt>
              <dd className="text-ink">{account?.name ?? "—"}</dd>
              <dt className="text-text-soft">Primary email</dt>
              <dd className="text-ink">{account?.primary_email ?? "—"}</dd>
              <dt className="text-text-soft">Plan</dt>
              <dd className="text-ink capitalize">
                {account?.subscription_tier ?? "—"}
              </dd>
            </dl>
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
        </div>
      </div>
    </main>
  );
}
