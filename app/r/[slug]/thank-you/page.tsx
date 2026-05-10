import { notFound } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { STRINGS, isLanguage, type Language } from "@/lib/i18n/review";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Thank you",
};

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ via?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const { via, lang: langOverride } = await searchParams;

  const supabase = createServiceClient();
  const { data: location } = await supabase
    .from("locations")
    .select("display_name, brand_color, logo_url, default_language, supported_languages")
    .eq("slug", slug)
    .maybeSingle();
  if (!location) notFound();

  const supported = location.supported_languages;
  const lang: Language =
    isLanguage(langOverride) && supported.includes(langOverride)
      ? (langOverride as Language)
      : isLanguage(location.default_language)
        ? (location.default_language as Language)
        : "en";

  const s = STRINGS[lang];
  const isPrivate = via === "private";

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center py-6 px-4">
      <div className="mx-auto max-w-md w-full text-center space-y-6">
        <div className="flex items-center justify-center gap-2.5">
          {location.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={location.logo_url}
              alt=""
              className="h-9 w-9 rounded-md object-cover"
            />
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-md text-cream font-display text-[15px]"
              style={{ backgroundColor: location.brand_color ?? "#1F4D3F" }}
            >
              {location.display_name.charAt(0).toUpperCase()}
            </span>
          )}
          <p className="font-display text-[15px] text-ink leading-tight">
            {location.display_name}
          </p>
        </div>

        <div className="rounded-2xl border border-border-base bg-paper p-8 shadow-sm space-y-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
            <CircleCheck className="h-6 w-6" />
          </span>
          <h1 className="font-display text-[28px] text-ink leading-tight">
            {s.thanks_title}
          </h1>
          <p className="text-[14.5px] text-text-soft leading-relaxed">
            {isPrivate ? s.thanks_private : s.thanks_google}
          </p>
        </div>

        <p className="text-center text-[11px] text-text-muted">
          Powered by BAAM Review
        </p>
      </div>
    </main>
  );
}
