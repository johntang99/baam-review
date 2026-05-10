import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import {
  STRINGS,
  pickLanguage,
  isLanguage,
  type Language,
} from "@/lib/i18n/review";
import { FeedbackForm } from "./feedback-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Send a private message",
};

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const { t: token, lang: langOverride } = await searchParams;

  const supabase = createServiceClient();
  const { data: location } = await supabase
    .from("locations")
    .select(
      "id, slug, display_name, brand_color, logo_url, default_language, supported_languages",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!location) notFound();

  let request: { id: string; language: string | null } | null = null;
  if (token) {
    const { data: r } = await supabase
      .from("review_requests")
      .select("id, language, location_id")
      .eq("tracking_token", token)
      .maybeSingle();
    if (r && r.location_id === location.id)
      request = { id: r.id, language: r.language };
  }

  const headersList = await headers();
  const acceptLanguage = headersList.get("accept-language");

  const lang: Language =
    isLanguage(langOverride) &&
    location.supported_languages.includes(langOverride)
      ? (langOverride as Language)
      : pickLanguage({
          request,
          acceptLanguage,
          supported: location.supported_languages,
          fallback: location.default_language,
        });

  const s = STRINGS[lang];

  const backParams = new URLSearchParams();
  if (token) backParams.set("t", token);
  backParams.set("lang", lang);
  const backHref = `/r/${location.slug}?${backParams.toString()}`;

  return (
    <main className="min-h-screen bg-cream py-6 px-4 sm:py-10">
      <div className="mx-auto max-w-md space-y-6">
        <Brand
          displayName={location.display_name}
          logoUrl={location.logo_url}
          brandColor={location.brand_color ?? "#1F4D3F"}
          initial={location.display_name.charAt(0).toUpperCase()}
        />

        <header className="space-y-1">
          <h1 className="font-display text-[26px] text-ink leading-tight">
            {s.private_title}
          </h1>
          <p className="text-[14px] text-text-soft leading-relaxed">
            {s.private_subtitle}
          </p>
        </header>

        <div className="rounded-2xl border border-border-base bg-paper p-5 sm:p-6 shadow-sm">
          <FeedbackForm
            slug={location.slug}
            lang={lang}
            token={token ?? null}
            backHref={backHref}
          />
        </div>

        <p className="text-center text-[11px] text-text-muted">
          Powered by BAAM Review
        </p>
      </div>
    </main>
  );
}

function Brand({
  displayName,
  logoUrl,
  brandColor,
  initial,
}: {
  displayName: string;
  logoUrl: string | null;
  brandColor: string;
  initial: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="h-9 w-9 rounded-md object-cover"
        />
      ) : (
        <span
          className="flex h-9 w-9 items-center justify-center rounded-md text-cream font-display text-[15px]"
          style={{ backgroundColor: brandColor }}
        >
          {initial}
        </span>
      )}
      <p className="font-display text-[15px] text-ink leading-tight truncate">
        {displayName}
      </p>
    </div>
  );
}
