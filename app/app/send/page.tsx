import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isTwilioConfigured } from "@/lib/messaging/twilio";
import { getSelectedLocationId } from "@/lib/selected-location";
import { PageHeader } from "@/components/admin/page-header";
import { getLocationBillingMap } from "@/lib/billing/access";
import {
  getInternalContext,
  getVisibleLocationIds,
} from "@/lib/auth/staff";
import { SendForm } from "./send-form";

export const metadata = {
  title: "Send request — BAAM Review",
};

export default async function SendPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/send");

  const internal = await getInternalContext(supabase, user.id);
  const visibleIds = await getVisibleLocationIds(supabase, internal);

  let locationsQuery = supabase
    .from("locations")
    .select("id, display_name, default_language, supported_languages")
    .order("created_at", { ascending: false });
  if (visibleIds !== null) {
    locationsQuery = locationsQuery.in(
      "id",
      visibleIds.length > 0
        ? visibleIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  }
  const { data: locations } = await locationsQuery;

  const billing = await getLocationBillingMap(
    (locations ?? []).map((l) => l.id),
  );
  const blockedLocationIds = (locations ?? [])
    .filter((l) => !billing.get(l.id)?.allowed)
    .map((l) => l.id);

  const smsEnabled = isTwilioConfigured();
  const selectedLocationId = await getSelectedLocationId();
  // Use the selected location as initial selection; if none selected or stale,
  // fall back to the first.
  const initialLocationId =
    (locations ?? []).find((l) => l.id === selectedLocationId)?.id ??
    (locations ?? [])[0]?.id ??
    null;

  return (
    <main className="px-10 py-10 space-y-8">
      <PageHeader
        eyebrow="Send"
        title="Send a review request"
        description="One customer at a time. They'll receive a link to a 60-second review flow."
      />
      <SendForm
        locations={locations ?? []}
        smsEnabled={smsEnabled}
        initialLocationId={initialLocationId}
        blockedLocationIds={blockedLocationIds}
      />
    </main>
  );
}
