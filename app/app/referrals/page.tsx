import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Gift, Settings, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedLocationId } from "@/lib/selected-location";
import {
  getInternalContext,
  canAccessLocation,
  getVisibleLocationIds,
} from "@/lib/auth/staff";
import type {
  ReferralConfig,
  RewardConfig,
} from "@/lib/database.types";
import { PageHeader } from "@/components/admin/page-header";
import { RewardSetup } from "./reward-setup";
import { ReferralSetup } from "./referral-setup";
import { AdvocatesTable } from "./advocates-table";
import { ActivityFeed } from "./activity-feed";

export const metadata = { title: "Reward & Referrals — BAAM Review" };
export const dynamic = "force-dynamic";

type Tab = "reward" | "referral" | "advocates" | "activity";

const TAB_DESC: Record<Tab, string> = {
  reward:
    "Configure the personal thank-you reward shown to your reviewer on the thank-you page. Works for any business — visit, purchase, service, or product. Add an image and description to make it your own.",
  referral:
    "Configure the offer your reviewers' friends see on the share landing page. Each settings change applies to new share links generated after save.",
  advocates:
    "Reviewers who shared their link. Ranked by conversions, clicks, then recency over the last 90 days.",
  activity:
    "Recent referral events across all your locations — every share view, offer click, and converted review.",
};

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabRaw } = await searchParams;
  const tab: Tab =
    tabRaw === "referral"
      ? "referral"
      : tabRaw === "advocates"
        ? "advocates"
        : tabRaw === "activity"
          ? "activity"
          : "reward";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/referrals");
  const selectedId = await getSelectedLocationId();

  const internal = await getInternalContext(supabase, user.id);
  const visibleIds = await getVisibleLocationIds(supabase, internal);
  const idFilter =
    visibleIds === null
      ? null
      : visibleIds.length > 0
        ? visibleIds
        : ["00000000-0000-0000-0000-000000000000"];

  // Only honor the cookie's selectedId if the user is allowed to see it.
  const selectedOk = selectedId
    ? await canAccessLocation(supabase, internal, selectedId)
    : false;

  let { data: location } = selectedOk && selectedId
    ? await supabase
        .from("locations")
        .select(
          "id, account_id, slug, display_name, brand_color, booking_url, referral_config, reward_config",
        )
        .eq("id", selectedId)
        .maybeSingle()
    : { data: null };

  if (!location) {
    let firstQuery = supabase
      .from("locations")
      .select(
        "id, account_id, slug, display_name, brand_color, booking_url, referral_config, reward_config",
      )
      .order("created_at", { ascending: false })
      .limit(1);
    if (idFilter) firstQuery = firstQuery.in("id", idFilter);
    const { data: first } = await firstQuery.maybeSingle();
    location = first;
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://review.baamplatform.com";

  if (!location) {
    return (
      <main className="px-10 py-10 space-y-6">
        <PageHeader
          eyebrow="Reward & Referrals"
          title="Set up your reward and referral program"
          description="Pick a location to configure the reward your reviewer gets and the offer they share with friends."
        />
        <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-10 text-center max-w-2xl">
          <p className="text-[14px] text-text-soft">
            Connect a Google Business Profile first so we have a location to
            attach the reward and offer to.
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
        eyebrow="Reward & Referrals"
        title={location.display_name}
        description={TAB_DESC[tab]}
      />

      <nav className="flex gap-1 border-b border-border-base">
        <TabLink
          href="/app/referrals?tab=reward"
          active={tab === "reward"}
          icon={Gift}
          label="Setup Reward"
        />
        <TabLink
          href="/app/referrals?tab=referral"
          active={tab === "referral"}
          icon={Settings}
          label="Setup Referral"
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

      {tab === "reward" && (
        <RewardSetup
          locationId={location.id}
          accountId={location.account_id}
          brandColor={location.brand_color ?? "#1F4D3F"}
          bookingFallback={location.booking_url ?? null}
          displayName={location.display_name}
          initialConfig={(location.reward_config ?? {}) as RewardConfig}
        />
      )}

      {tab === "referral" && (
        <ReferralSetup
          locationId={location.id}
          accountId={location.account_id}
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
