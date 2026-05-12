import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import {
  isLanguage,
  type Language,
} from "@/lib/i18n/review";
import type { SocialHandles } from "@/lib/database.types";
import { ThankYouShell } from "@/components/review/thank-you-shell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Thank you",
};

function firstName(full: string | null | undefined): string | null {
  if (!full) return null;
  const trimmed = full.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    via?: string;
    lang?: string;
    t?: string;
    consent?: string;
  }>;
}) {
  const { slug } = await params;
  const { via, lang: langOverride, t: tokenParam, consent } = await searchParams;

  const supabase = createServiceClient();

  const { data: location } = await supabase
    .from("locations")
    .select(
      "id, slug, display_name, brand_color, logo_url, address, default_language, supported_languages, booking_url, social_handles, consent_display_enabled",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!location) notFound();

  const supportedRaw = location.supported_languages as string[];
  const lang: Language =
    isLanguage(langOverride) && supportedRaw.includes(langOverride)
      ? (langOverride as Language)
      : isLanguage(location.default_language)
        ? (location.default_language as Language)
        : "en";
  const supportedLangs = supportedRaw.filter(isLanguage);

  // Pull recipient + consent from the request if we have a tracking token.
  let recipientName: string | null = null;
  let requestId: string | null = null;
  let consentDisplay = false;
  let rating = 5;
  if (tokenParam) {
    const { data: req } = await supabase
      .from("review_requests")
      .select("id, recipient_name, consent_display, location_id")
      .eq("tracking_token", tokenParam)
      .maybeSingle();
    if (req && req.location_id === location.id) {
      requestId = req.id;
      recipientName = req.recipient_name;
      consentDisplay = !!req.consent_display;
    }
  }
  // Query-param override (set by the review flow when posting to Google).
  if (consent === "1") consentDisplay = true;

  const isPrivate = via === "private";

  // Build share URL + image only when consent allows it.
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://review.baamplatform.com";
  const shareToken = requestId ?? null;
  // Share link points at the dedicated share-card landing /s/<token>, not the
  // review-collection /r/<slug> page — friends should see the recommendation
  // first, then choose to book / open in maps / leave their own review.
  const shareUrl =
    consentDisplay && !isPrivate && shareToken
      ? `${baseUrl}/s/${shareToken}?lang=${lang}`
      : null;
  const shareImageUrl =
    consentDisplay && !isPrivate && shareToken
      ? `${baseUrl}/og/share/${shareToken}`
      : null;

  // Short blurb that goes on the share card preview. Real review text is not
  // included because the customer types it directly into Google, not here.
  const localizedQuote =
    lang === "zh"
      ? recipientName
        ? `${recipientName.split(" ")[0]} 刚刚推荐了 ${location.display_name}。`
        : `${location.display_name} 刚获得一条 ${rating} 星好评。`
      : lang === "es"
        ? recipientName
          ? `${recipientName.split(" ")[0]} acaba de recomendar a ${location.display_name}.`
          : `${location.display_name} acaba de recibir una reseña de ${rating} estrellas.`
        : recipientName
          ? `${recipientName.split(" ")[0]} just recommended ${location.display_name}.`
          : `${location.display_name} just got a new ${rating}-star review.`;

  return (
    <main className="flex min-h-screen flex-col items-center bg-cream px-4 pb-10 sm:px-6">
      <ThankYouShell
        lang={lang}
        supportedLangs={supportedLangs}
        location={{
          id: location.id,
          slug: location.slug,
          displayName: location.display_name,
          brandColor: location.brand_color ?? "#1F4D3F",
          logoUrl: location.logo_url,
          address: location.address,
          bookingUrl: location.booking_url,
          socialHandles: (location.social_handles ?? {}) as SocialHandles,
        }}
        recipientFirstName={firstName(recipientName)}
        requestId={requestId}
        rating={rating}
        consentDisplay={consentDisplay && location.consent_display_enabled}
        shareToken={shareToken}
        shareUrl={shareUrl}
        shareImageUrl={shareImageUrl}
        isPrivate={isPrivate}
        shareablePreviewQuote={localizedQuote}
      />
    </main>
  );
}
