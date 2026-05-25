import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getInternalContext,
  canAccessLocation,
  getVisibleLocationIds,
} from "@/lib/auth/staff";
import { PageHeader } from "@/components/admin/page-header";
import { InContentLocationPicker } from "@/components/locations/in-content-location-picker";
import { QrBuilder } from "./qr-builder";

export const metadata = {
  title: "QR code — BAAM Review",
};

export default async function QrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/locations/${id}/qr`);

  const internal = await getInternalContext(supabase, user.id);
  const allowed = await canAccessLocation(supabase, internal, id);
  if (!allowed) redirect("/app/locations");
  const visibleIds = await getVisibleLocationIds(supabase, internal);

  let locationsQuery = supabase
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
    supabase
      .from("locations")
      .select("id, slug, display_name, default_language, supported_languages")
      .eq("id", id)
      .maybeSingle(),
    locationsQuery,
  ]);
  if (!location) notFound();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://review.baamplatform.com";

  return (
    <main className="px-10 py-10">
      <div className="max-w-5xl space-y-6">
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
        <div>
          <PageHeader
            eyebrow="QR code"
            title="Printable QR poster"
            description="Generate a letter-size PDF you can print and place at the front desk, on receipts, or wherever customers wait. Each variant tracks where it was scanned from."
          />
        </div>

        <QrBuilder
          slug={location.slug}
          supportedLanguages={location.supported_languages}
          defaultLanguage={location.default_language}
          appUrl={appUrl}
        />
      </div>
    </main>
  );
}
