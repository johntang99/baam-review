import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { WidgetConfig } from "@/lib/database.types";
import { PageHeader } from "@/components/admin/page-header";
import { InContentLocationPicker } from "@/components/locations/in-content-location-picker";
import { EmbedTabs } from "./embed-tabs";

export const metadata = {
  title: "Embed — BAAM Review",
};

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/locations/${id}/embed`);

  const [{ data: location }, { data: locations }] = await Promise.all([
    supabase
      .from("locations")
      .select(
        "id, slug, display_name, brand_color, default_language, supported_languages, widget_config",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("locations")
      .select("id, display_name, brand_color, logo_url")
      .order("created_at", { ascending: false }),
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
            eyebrow="Embed"
            title="Website embed"
            description="Two ways to put BAAM on your website: a single Leave-a-Review button, or the full review display widget with schema markup."
          />
        </div>

        <EmbedTabs
          locationId={location.id}
          slug={location.slug}
          appUrl={appUrl}
          brandColor={location.brand_color ?? "#1F4D3F"}
          supportedLanguages={location.supported_languages}
          defaultLanguage={location.default_language}
          widgetConfig={(location.widget_config ?? {}) as WidgetConfig}
        />
      </div>
    </main>
  );
}
