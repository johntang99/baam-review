import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getInternalContext,
  canAccessLocation,
  getVisibleLocationIds,
} from "@/lib/auth/staff";
import { getLocationBillingMap } from "@/lib/billing/access";
import { PageHeader } from "@/components/admin/page-header";
import { InContentLocationPicker } from "@/components/locations/in-content-location-picker";
import { SettingsForm } from "./settings-form";

export const metadata = {
  title: "Location setup — BAAM Review",
};

export default async function LocationSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/locations/${id}`);

  const { data: profile } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.account_id) redirect("/app/locations");

  // Role-based access — sales / account_manager users must be either the
  // connector (sales) or assigned (account_manager) to view a location.
  // Admin and customers fall through (canAccessLocation returns true).
  const internal = await getInternalContext(supabase, user.id);
  const allowed = await canAccessLocation(supabase, internal, id);
  if (!allowed) redirect("/app/locations");

  // Visibility filter for the in-content picker so it only shows
  // locations the user is allowed to switch to.
  const visibleIds = await getVisibleLocationIds(supabase, internal);

  // Fetch the active location + the full list (for the in-content picker)
  // in parallel.
  //
  // Internal staff use the service client so cross-tenant locations
  // (e.g., self-service customers viewed by a BAAM admin) are reachable.
  // canAccessLocation has already gated access by role above, so widening
  // the data-fetch scope here doesn't expand who can SEE what. Customers
  // keep going through the RLS-scoped client.
  const locsClient = internal ? createServiceClient() : supabase;

  let locationsQuery = locsClient
    .from("locations")
    .select("id, display_name, brand_color, logo_url")
    .order("created_at", { ascending: false });
  if (visibleIds !== null) {
    locationsQuery = locationsQuery.in(
      "id",
      visibleIds.length > 0
        ? visibleIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  }
  const [{ data: location }, { data: locations }] = await Promise.all([
    locsClient.from("locations").select("*").eq("id", id).maybeSingle(),
    locationsQuery,
  ]);

  if (!location) notFound();

  // Billing summary + interval for the Billing tab. Reuses the same helper
  // that drives the badge on /app/locations, plus billing_interval pulled
  // directly off location_subscriptions (not in the summary type).
  const billingMap = await getLocationBillingMap([location.id]);
  const billingSummary = billingMap.get(location.id) ?? null;
  const svc = createServiceClient();
  const { data: subRow } = await svc
    .from("location_subscriptions")
    .select("billing_interval")
    .eq("location_id", location.id)
    .maybeSingle();
  const billingInterval = subRow?.billing_interval ?? null;

  const defaultFromAddress =
    process.env.RESEND_FROM ?? "no-reply@baamplatform.com";

  return (
    <main className="px-10 py-10">
      <div className="max-w-4xl space-y-6">
        <div className="space-y-3">
          <Link
            href="/app/locations"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-text-soft hover:text-text"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All locations
          </Link>

          <InContentLocationPicker
            locations={locations ?? []}
            currentId={location.id}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-[16px] font-bold tracking-[0.03em] text-ink">
            Location Setup
          </p>
          <PageHeader
            title={location.display_name}
            description={location.address ?? undefined}
          />
        </div>

        <SettingsForm
          location={location}
          accountId={profile.account_id}
          defaultFromAddress={defaultFromAddress}
          billingSummary={billingSummary}
          billingInterval={billingInterval}
        />
      </div>
    </main>
  );
}
