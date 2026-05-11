import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
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

  const { data: location } = await supabase
    .from("locations")
    .select("id, slug, display_name, default_language, supported_languages")
    .eq("id", id)
    .maybeSingle();
  if (!location) notFound();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://review.baamplatform.com";

  return (
    <main className="px-10 py-10">
      <div className="max-w-5xl space-y-8">
        <div>
          <Link
            href={`/app/locations/${location.id}`}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-text-soft hover:text-text mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {location.display_name}
          </Link>
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
