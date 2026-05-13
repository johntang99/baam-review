import Link from "next/link";
import { Activity, Settings, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedLocationId } from "@/lib/selected-location";
import type { ReferralConfig } from "@/lib/database.types";
import { PageHeader } from "@/components/admin/page-header";
import { ReferralSetup } from "./referral-setup";
import { AdvocatesTable } from "./advocates-table";
import { ActivityFeed } from "./activity-feed";

export const metadata = { title: "Referrals — BAAM Review" };
export const dynamic = "force-dynamic";

const TAB_DESC: Record<Tab, string> = {
  setup:
    "Configure the offer your reviewers' friends see on the share landing page. Each settings change applies to new share links generated after save.",
  advocates:
    "Reviewers who shared their link. Ranked by conversions, clicks, then recency over the last 90 days.",
  activity:
    "Recent referral events across all your locations — every share view, offer click, and converted review.",
};

type Tab = "setup" | "advocates" | "activity";

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabRaw } = await searchParams;
  const tab: Tab =
    tabRaw === "advocates"
      ? "advocates"
      : tabRaw === "activity"
        ? "activity"
        : "setup";

  const supabase = await createClient();
  const selectedId = await getSelectedLocationId();

  let { data: location } = selectedId
    ? await supabase
        .from("locations")
        .select(
          "id, slug, display_name, brand_color, booking_url, referral_config",
        )
        .eq("id", selectedId)
        .maybeSingle()
    : { data: null };

  if (!location) {
    const { data: first } = await supabase
      .from("locations")
      .select(
        "id, slug, display_name, brand_color, booking_url, referral_config",
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    location = first;
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://review.baamplatform.com";

  if (!location) {
    return (
      <main className="px-10 py-10 space-y-6">
        <PageHeader
          eyebrow="Referrals"
          title="Set up your referral program"
          description="Pick a location to configure the offer your reviewers share with friends."
        />
        <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-10 text-center max-w-2xl">
          <p className="text-[14px] text-text-soft">
            Connect a Google Business Profile first so we have a location to
            attach the offer to.
          </p>
          <Link
            href="/app/locations"
            className="mt-4 inline-block text-[13.5px] font-medium text-forest hover:underline"
          >
            Go to Locations →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="px-10 py-10 space-y-6">
      <PageHeader
        eyebrow="Referrals"
        title={location.display_name}
        description={TAB_DESC[tab]}
      />

      <nav className="flex gap-1 border-b border-border-base">
        <TabLink
          href="/app/referrals?tab=setup"
          active={tab === "setup"}
          icon={Settings}
          label="Setup"
        />
        <TabLink
          href="/app/referrals?tab=advocates"
          active={tab === "advocates"}
          icon={Trophy}
          label="Best advocates"
        />
        <TabLink
          href="/app/referrals?tab=activity"
          active={tab === "activity"}
          icon={Activity}
          label="Activity"
        />
      </nav>

      {tab === "setup" && (
        <ReferralSetup
          locationId={location.id}
          locationSlug={location.slug}
          brandColor={location.brand_color ?? "#1F4D3F"}
          bookingFallback={location.booking_url ?? null}
          appUrl={appUrl}
          initialConfig={(location.referral_config ?? {}) as ReferralConfig}
        />
      )}

      {tab === "advocates" && <AdvocatesTable />}

      {tab === "activity" && <ActivityFeed locationId={location.id} />}
    </main>
  );
}

function TabLink({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`relative inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors ${
        active ? "text-ink" : "text-text-soft hover:text-ink"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {active && (
        <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-forest" />
      )}
    </Link>
  );
}
