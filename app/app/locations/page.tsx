import Link from "next/link";
import { MapPin, Plus, AlertCircle, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Locations — BAAM Review",
};

const ERRORS: Record<string, string> = {
  invalid_state: "The connection attempt expired or was tampered with. Please try again.",
  token_exchange: "Google rejected the authorization. Please retry.",
  token_persist: "We received your tokens but couldn't save them. Please retry.",
  no_account: "Your account could not be located. Sign out and back in, then retry.",
  access_denied: "Connection canceled. You can try again anytime.",
};

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: locations } = await supabase
    .from("locations")
    .select("id, slug, display_name, address, business_type, brand_color, logo_url")
    .order("created_at", { ascending: false });

  const errorMessage = params.error ? ERRORS[params.error] ?? params.error : null;

  return (
    <main className="px-10 py-10 space-y-8">
      <PageHeader
        eyebrow="Setup"
        title="Locations"
        description="Connect your Google Business Profile to start collecting reviews. Each location gets its own public review page and QR code."
      >
        <Link href="/api/auth/google/start">
          <Button>
            <Plus className="h-4 w-4" />
            Connect Google
          </Button>
        </Link>
      </PageHeader>

      {errorMessage && (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-alert/30 bg-alert/5 p-4 text-[13.5px] text-alert"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {!locations || locations.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 max-w-4xl">
          {locations.map((loc) => (
            <li key={loc.id}>
              <Link
                href={`/app/locations/${loc.id}`}
                className="group flex items-start gap-3 rounded-xl border border-border-base bg-paper p-5 shadow-sm transition-colors hover:bg-hover"
              >
                {loc.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={loc.logo_url}
                    alt=""
                    className="h-9 w-9 flex-shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-cream font-display text-[15px]"
                    style={{ backgroundColor: loc.brand_color ?? "#1F4D3F" }}
                  >
                    {loc.display_name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-display text-[17px] text-ink leading-tight truncate">
                    {loc.display_name}
                  </p>
                  {loc.business_type && (
                    <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
                      {loc.business_type}
                    </p>
                  )}
                  {loc.address && (
                    <p className="text-[13px] text-text-soft truncate">
                      {loc.address}
                    </p>
                  )}
                  <p className="text-[12.5px] text-text-muted pt-1">
                    /r/{loc.slug}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 mt-1 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-10 text-center max-w-2xl">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-forest/10 text-forest">
        <MapPin className="h-5 w-5" />
      </span>
      <h2 className="mt-4 font-display text-[20px] text-ink">
        No locations yet
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-[14px] text-text-soft leading-relaxed">
        Connect your Google Business Profile and we&apos;ll pull in your business
        name, address, and the deep-link Google uses for reviews.
      </p>
      <Link href="/api/auth/google/start" className="mt-5 inline-block">
        <Button>
          <Plus className="h-4 w-4" />
          Connect Google Business Profile
        </Button>
      </Link>
    </div>
  );
}
