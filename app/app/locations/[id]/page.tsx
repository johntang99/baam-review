import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "./settings-form";

export const metadata = {
  title: "Location settings — BAAM Review",
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

  const { data: location } = await supabase
    .from("locations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!location) notFound();

  return (
    <main className="px-10 py-10">
      <div className="max-w-4xl space-y-8">
        <div>
          <Link
            href="/app/locations"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-text-soft hover:text-text mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All locations
          </Link>
          <PageHeader
            eyebrow="Location settings"
            title={location.display_name}
            description={location.address ?? undefined}
          >
            {location.google_review_url && (
              <a
                href={location.google_review_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[12.5px] text-text-soft hover:text-forest"
              >
                Google review form
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </PageHeader>
          <p className="mt-2 inline-block rounded-md bg-cream-deep px-2 py-0.5 text-[11.5px] text-text-soft font-mono">
            /r/{location.slug}
          </p>
        </div>

        <SettingsForm location={location} accountId={profile.account_id} />
      </div>
    </main>
  );
}
