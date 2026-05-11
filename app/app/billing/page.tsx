import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = {
  title: "Billing — BAAM Review",
};

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/billing");

  return (
    <main className="px-10 py-10 space-y-6">
      <PageHeader
        eyebrow="Billing"
        title="Plan & invoices"
        description="Subscription tiers and self-serve billing land in Session 11."
      />

      <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-8 max-w-2xl space-y-3">
        <p className="text-[14px] text-text">
          You&apos;re on the <strong>Trial</strong> plan.
        </p>
        <p className="text-[13px] text-text-soft leading-relaxed">
          Stripe-powered subscriptions, the Customer Portal, and tier-based
          request caps arrive in the next session. For now, the trial is
          unlimited — keep using the product, and your data will carry over.
        </p>
      </div>
    </main>
  );
}
