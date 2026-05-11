import Link from "next/link";
import { QrCode, Code } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedLocationId } from "@/lib/selected-location";
import { PageHeader } from "@/components/admin/page-header";
import { QrBuilder } from "../locations/[id]/qr/qr-builder";
import { EmbedBuilder } from "../locations/[id]/embed/embed-builder";

export const metadata = {
  title: "Embed & QR — BAAM Review",
};

export const dynamic = "force-dynamic";

type Tab = "qr" | "embed";

export default async function ShareePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabRaw } = await searchParams;
  const tab: Tab = tabRaw === "embed" ? "embed" : "qr";

  const supabase = await createClient();

  const selectedId = await getSelectedLocationId();

  let { data: location } = selectedId
    ? await supabase
        .from("locations")
        .select(
          "id, slug, display_name, default_language, supported_languages, brand_color",
        )
        .eq("id", selectedId)
        .maybeSingle()
    : { data: null };

  // Fallback: if no location selected (or stale cookie), pick the first.
  if (!location) {
    const { data: first } = await supabase
      .from("locations")
      .select(
        "id, slug, display_name, default_language, supported_languages, brand_color",
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
          eyebrow="Share"
          title="Embed & QR"
          description="Pick a location to generate share assets."
        />
        <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-10 text-center max-w-2xl">
          <p className="text-[14px] text-text-soft">
            Connect a Google Business Profile first to generate QR posters and
            embed snippets.
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
        description={
          tab === "qr"
            ? "Printable letter-size poster. Each variant tracks where it was scanned from."
            : "One-line script tag the customer pastes anywhere on their website."
        }
      />

      <nav className="flex gap-1 border-b border-border-base">
        <TabLink
          href="/app/share?tab=qr"
          active={tab === "qr"}
          icon={QrCode}
          label="QR poster"
        />
        <TabLink
          href="/app/share?tab=embed"
          active={tab === "embed"}
          icon={Code}
          label="Website embed"
        />
      </nav>

      <div className="max-w-5xl">
        {tab === "qr" ? (
          <QrBuilder
            slug={location.slug}
            supportedLanguages={location.supported_languages}
            defaultLanguage={location.default_language}
            appUrl={appUrl}
          />
        ) : (
          <EmbedBuilder
            slug={location.slug}
            appUrl={appUrl}
            brandColor={location.brand_color ?? "#1F4D3F"}
            supportedLanguages={location.supported_languages}
            defaultLanguage={location.default_language}
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
