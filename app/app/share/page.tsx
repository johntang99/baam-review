import Link from "next/link";
import { redirect } from "next/navigation";
import { Code, LayoutGrid, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { WidgetConfig } from "@/lib/database.types";
import { getSelectedLocationId } from "@/lib/selected-location";
import {
  getInternalContext,
  canAccessLocation,
  getVisibleLocationIds,
} from "@/lib/auth/staff";
import { PageHeader } from "@/components/admin/page-header";
import { QrBuilder } from "../locations/[id]/qr/qr-builder";
import { EmbedBuilder } from "../locations/[id]/embed/embed-builder";
import { WidgetBuilder } from "../locations/[id]/embed/widget-builder";

export const metadata = {
  title: "Widget & embed — BAAM Review",
};

export const dynamic = "force-dynamic";

type Tab = "widget" | "button" | "qr";

const TAB_DESC: Record<Tab, string> = {
  widget:
    "Review widget your customers paste on their site. Carousel / single / grid / compact. Schema markup baked in.",
  button:
    "A single “Leave a review” button. Pastes anywhere on the site.",
  qr: "Printable letter-size poster. Each variant tracks where it was scanned from.",
};

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabRaw } = await searchParams;
  const tab: Tab =
    tabRaw === "button" ? "button" : tabRaw === "qr" ? "qr" : "widget";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/share");
  const selectedId = await getSelectedLocationId();

  const internal = await getInternalContext(supabase, user.id);
  const visibleIds = await getVisibleLocationIds(supabase, internal);
  const idFilter =
    visibleIds === null
      ? null
      : visibleIds.length > 0
        ? visibleIds
        : ["00000000-0000-0000-0000-000000000000"];

  const selectedOk = selectedId
    ? await canAccessLocation(supabase, internal, selectedId)
    : false;

  let { data: location } = selectedOk && selectedId
    ? await supabase
        .from("locations")
        .select(
          "id, slug, display_name, default_language, supported_languages, brand_color, widget_config",
        )
        .eq("id", selectedId)
        .maybeSingle()
    : { data: null };

  if (!location) {
    let firstQuery = supabase
      .from("locations")
      .select(
        "id, slug, display_name, default_language, supported_languages, brand_color, widget_config",
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
          eyebrow="Share"
          title="Widget & embed"
          description="Pick a location to generate share assets."
        />
        <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-10 text-center max-w-2xl">
          <p className="text-[14px] text-text-soft">
            Connect a Google Business Profile first to generate the widget,
            embed snippet, or QR poster.
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
        eyebrow="Share"
        title={location.display_name}
        description={TAB_DESC[tab]}
      />

      <nav className="flex gap-1 border-b border-border-base">
        <TabLink
          href="/app/share?tab=widget"
          active={tab === "widget"}
          icon={LayoutGrid}
          label="Display widget"
        />
        <TabLink
          href="/app/share?tab=button"
          active={tab === "button"}
          icon={Code}
          label="Leave-a-review button"
        />
        <TabLink
          href="/app/share?tab=qr"
          active={tab === "qr"}
          icon={QrCode}
          label="QR poster"
        />
      </nav>

      <div className="max-w-5xl">
        {tab === "widget" ? (
          <WidgetBuilder
            locationId={location.id}
            slug={location.slug}
            appUrl={appUrl}
            brandColor={location.brand_color ?? "#1F4D3F"}
            initialConfig={(location.widget_config ?? {}) as WidgetConfig}
          />
        ) : tab === "button" ? (
          <EmbedBuilder
            slug={location.slug}
            appUrl={appUrl}
            brandColor={location.brand_color ?? "#1F4D3F"}
            supportedLanguages={location.supported_languages}
            defaultLanguage={location.default_language}
          />
        ) : (
          <QrBuilder
            slug={location.slug}
            supportedLanguages={location.supported_languages}
            defaultLanguage={location.default_language}
            appUrl={appUrl}
          />
        )}
      </div>
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
      className={`relative px-3 py-2 text-[13px] font-medium transition-colors inline-flex items-center gap-1.5 ${
        active ? "text-ink" : "text-text-soft hover:text-ink"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {active && (
        <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-forest" />
      )}
    </Link>
  );
}
