import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { Section } from "@/components/ui/section";
import { SenderForm } from "./sender-form";

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
    .select("name, primary_email, sender_email, sender_name, sender_verified_at, subscription_tier")
    .eq("id", profile.account_id)
    .maybeSingle();

  const defaultFromAddress =
    process.env.RESEND_FROM ?? "no-reply@baamplatform.com";

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
            title="Email sender"
            description="Send review-request emails from your own domain. This is the single biggest lever for deliverability — emails sent from your domain land in Primary, while emails from a shared address (the default) often go to Gmail's Promotions tab."
          >
            <SenderForm
              initialEmail={account?.sender_email ?? null}
              initialName={account?.sender_name ?? null}
              verified={!!account?.sender_verified_at}
              defaultFromAddress={defaultFromAddress}
            />
          </Section>

          <Section
            title="Account"
            description="Read-only for v1. Reach out to support for changes."
          >
            <dl className="grid grid-cols-[160px_1fr] gap-y-3 text-[13.5px]">
              <dt className="text-text-soft">Account name</dt>
              <dd className="text-ink">{account?.name ?? "—"}</dd>
              <dt className="text-text-soft">Primary email</dt>
              <dd className="text-ink">{account?.primary_email ?? "—"}</dd>
              <dt className="text-text-soft">Plan</dt>
              <dd className="text-ink capitalize">{account?.subscription_tier ?? "—"}</dd>
            </dl>
          </Section>
        </div>
      </div>
    </main>
  );
}
