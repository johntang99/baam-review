import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { Calendar, ExternalLink, MapPin } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import {
  STRINGS,
  isLanguage,
  type Language,
} from "@/lib/i18n/review";
import type { ReferralConfig } from "@/lib/database.types";
import {
  buildCtaUrl,
  resolveReferralConfig,
} from "@/lib/referral/config";
import { ShareReferralTracker } from "./share-referral-tracker";
import { OfferBlock } from "./offer-block";

export const dynamic = "force-dynamic";

const SHARE_STRINGS: Record<
  Language,
  {
    eyebrow: string;
    headline: string;
    headlineEm: string;
    sub: string;
    bookCta: string;
    visitCta: string;
    leaveOwn: string;
    poweredBy: string;
  }
> = {
  en: {
    eyebrow: "Recommended by a customer",
    headline: "Someone you know loved.",
    headlineEm: "loved.",
    sub: "Their visit — and now, hopefully yours.",
    bookCta: "Book a visit",
    visitCta: "Open in Maps",
    leaveOwn: "Leave your own review",
    poweredBy: "Powered by BAAM Review",
  },
  zh: {
    eyebrow: "顾客推荐",
    headline: "您认识的人最近喜欢的。",
    headlineEm: "最近喜欢的。",
    sub: "他们的体验 —— 接下来，或许也是您的。",
    bookCta: "预约就诊",
    visitCta: "在地图中打开",
    leaveOwn: "留下您自己的评价",
    poweredBy: "由 BAAM Review 提供技术支持",
  },
  es: {
    eyebrow: "Recomendado por un cliente",
    headline: "Alguien que conoces adoró.",
    headlineEm: "adoró.",
    sub: "Su visita — y ahora, esperamos, la suya.",
    bookCta: "Reservar una visita",
    visitCta: "Abrir en Mapas",
    leaveOwn: "Deje su propia reseña",
    poweredBy: "Con tecnología de BAAM Review",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();
  const { data: req } = await supabase
    .from("review_requests")
    .select("recipient_name, location_id")
    .eq("id", token)
    .maybeSingle();
  if (!req) return { title: "Recommended" };
  const { data: loc } = await supabase
    .from("locations")
    .select("display_name")
    .eq("id", req.location_id)
    .maybeSingle();
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://review.baamplatform.com";
  const ogImage = `${baseUrl}/og/share/${token}`;
  const title = loc?.display_name
    ? `${loc.display_name} — recommended by a customer`
    : "A recommendation";
  return {
    title,
    openGraph: {
      title,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [ogImage],
    },
  };
}

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    lang?: string;
    preview?: string;
    enabled?: string;
    offer_title?: string;
    offer_subtitle?: string;
    offer_code?: string;
    offer_image?: string;
    offer_image_aspect?: string;
    accent_color?: string;
    cta_label?: string;
    cta_url?: string;
    expires_at?: string;
  }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const langOverride = sp.lang;
  const isPreview = sp.preview === "1";

  const supabase = createServiceClient();
  const { data: req } = await supabase
    .from("review_requests")
    .select(
      "id, recipient_name, consent_display, location_id, language",
    )
    .eq("id", token)
    .maybeSingle();
  if (!req) notFound();

  const { data: location } = await supabase
    .from("locations")
    .select(
      "id, slug, display_name, address, brand_color, logo_url, booking_url, website_url, default_language, supported_languages, referral_config",
    )
    .eq("id", req.location_id)
    .maybeSingle();
  if (!location) notFound();

  const lang: Language = isLanguage(langOverride)
    ? langOverride
    : isLanguage(req.language)
      ? (req.language as Language)
      : isLanguage(location.default_language)
        ? (location.default_language as Language)
        : "en";
  const s = STRINGS[lang];
  const t = SHARE_STRINGS[lang];

  const brandAccent = location.brand_color ?? "#1F4D3F";
  const consent = !!req.consent_display;
  const firstName = req.recipient_name?.trim().split(/\s+/)[0] ?? null;
  const initial = location.display_name.charAt(0).toUpperCase();

  const attribution = consent && firstName
    ? s.share_preview_attribution.replace("{name}", firstName)
    : "";

  const quote =
    lang === "zh"
      ? consent && firstName
        ? `${firstName} 刚刚推荐了 ${location.display_name}。`
        : `${location.display_name} 收到了一条 5 星好评。`
      : lang === "es"
        ? consent && firstName
          ? `${firstName} acaba de recomendar a ${location.display_name}.`
          : `${location.display_name} acaba de recibir una reseña de 5 estrellas.`
        : consent && firstName
          ? `${firstName} just recommended ${location.display_name}.`
          : `${location.display_name} just got a 5-star review.`;

  const mapsUrl = location.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${location.display_name} ${location.address}`,
      )}`
    : null;
  const reviewPageUrl = `/r/${location.slug}?lang=${lang}&ref=${req.id}`;
  // The recommendation card footer links to the clinic's website when set.
  // Friends just got a recommendation; the natural next step is to learn
  // about the business, not to leave their own review.
  const businessHref = location.website_url ?? mapsUrl ?? null;

  // Resolve referral offer config — layer URL overrides on top of the saved
  // config when the admin preview iframe is asking. Preview mode also skips
  // the share_view insert so the leaderboard isn't polluted by previews.
  const baseRefCfg = location.referral_config as ReferralConfig | null;
  const previewRefCfg: ReferralConfig | null = isPreview
    ? {
        enabled: sp.enabled === "0" ? false : true,
        offer_title: sp.offer_title ?? baseRefCfg?.offer_title ?? null,
        offer_subtitle: sp.offer_subtitle ?? baseRefCfg?.offer_subtitle ?? null,
        offer_code: sp.offer_code ?? baseRefCfg?.offer_code ?? null,
        offer_image_url: sp.offer_image ?? baseRefCfg?.offer_image_url ?? null,
        offer_image_aspect:
          (sp.offer_image_aspect as
            | "16:9"
            | "4:3"
            | "1:1"
            | "21:9"
            | "3:4"
            | undefined) ??
          baseRefCfg?.offer_image_aspect ??
          null,
        accent_color: sp.accent_color ?? baseRefCfg?.accent_color ?? null,
        cta_label: sp.cta_label ?? baseRefCfg?.cta_label ?? null,
        cta_url: sp.cta_url ?? baseRefCfg?.cta_url ?? null,
        expires_at: sp.expires_at ?? baseRefCfg?.expires_at ?? null,
      }
    : null;
  const offer = resolveReferralConfig(previewRefCfg ?? baseRefCfg, brandAccent);
  // Resolved accent (referral override > location.brand_color) drives the
  // whole share landing card.
  const accent = offer.accentColor;
  const ctaOfferUrl = offer.hasOffer
    ? buildCtaUrl(offer, location.booking_url, req.id)
    : null;
  const bookingUrl = location.booking_url
    ? appendRefParam(location.booking_url, req.id)
    : null;

  // Log the share_view referral. Skip in preview mode so admin testing
  // doesn't pollute the leaderboard.
  const hdrs = await headers();
  const refererHost = parseHost(hdrs.get("referer"));
  const userAgent = hdrs.get("user-agent")?.slice(0, 500) ?? null;
  if (!isPreview) {
    await supabase.from("referrals").insert({
      location_id: location.id,
      advocate_request_id: req.id,
      event_type: "share_view",
      referrer_host: refererHost,
      user_agent: userAgent,
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-cream px-4 pb-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-[18px] pt-6">
        {/* Share card */}
        <section
          className="relative overflow-hidden rounded-3xl p-7 text-white shadow-lg"
          style={{
            background: `linear-gradient(160deg, ${accent} 0%, ${darken(accent, 0.25)} 100%)`,
          }}
        >
          <div className="pointer-events-none absolute right-[-20%] top-[-30%] h-[280px] w-[280px] rounded-full bg-white/12 blur-3xl" />

          <span className="relative mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11.5px] font-medium uppercase tracking-[0.08em]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FFD56A]" />
            {t.eyebrow}
          </span>

          <p className="relative mb-4 text-[20px] tracking-[3px] text-[#FFD56A]">
            ★★★★★
          </p>

          <p className="relative mb-5 font-display text-[22px] italic leading-[1.35]">
            {quote}
          </p>

          {attribution && (
            <p className="relative mb-6 text-[13px] text-white/75">
              {attribution}
            </p>
          )}

          <div className="relative flex items-center justify-between border-t border-white/[0.22] pt-5">
            {(() => {
              const inner = (
                <>
                  {location.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={location.logo_url}
                      alt=""
                      className="h-11 w-11 flex-shrink-0 rounded-[10px] object-cover bg-white"
                    />
                  ) : (
                    <span
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[10px] bg-white font-display text-[22px] font-semibold"
                      style={{ color: accent }}
                    >
                      {initial}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold">
                      {location.display_name}
                    </span>
                    {location.address && (
                      <span className="block truncate text-[12px] text-white/70">
                        {location.address}
                      </span>
                    )}
                  </span>
                </>
              );
              return businessHref ? (
                <a
                  href={businessHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90"
                >
                  {inner}
                </a>
              ) : (
                <div className="flex min-w-0 items-center gap-3">{inner}</div>
              );
            })()}
          </div>
        </section>

        {/* Referral offer — promotional block above the action buttons.
            Renders only when the location has an offer configured. */}
        {offer.hasOffer && (
          <OfferBlock
            accent={accent}
            title={offer.offerTitle!}
            subtitle={offer.offerSubtitle}
            code={offer.offerCode}
            imageUrl={offer.offerImageUrl}
            imageAspect={offer.offerImageAspect}
            ctaLabel={offer.ctaLabel}
            ctaUrl={ctaOfferUrl}
            expiresAt={offer.expiresAt}
            isExpired={offer.isExpired}
            lang={lang}
          />
        )}

        {/* Action buttons */}
        <section className="space-y-2.5">
          {bookingUrl && !offer.hasOffer && (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-referral-event="booking_click"
              className="flex w-full items-center gap-4 rounded-2xl p-[18px] text-left text-white shadow-sm transition-all hover:translate-x-0.5 hover:shadow-md"
              style={{ background: accent }}
            >
              <span className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[10px] bg-white/[0.18]">
                <Calendar className="h-5 w-5" />
              </span>
              <span className="flex-1 text-[15px] font-medium">
                {t.bookCta}
              </span>
              <span className="text-white/70">→</span>
            </a>
          )}

          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-referral-event="open_in_maps_click"
              className="flex w-full items-center gap-4 rounded-2xl border border-border-base bg-paper p-[18px] text-left transition-all hover:translate-x-0.5 hover:bg-cream-deep"
            >
              <span
                className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[10px] bg-cream-deep"
                style={{ color: accent }}
              >
                <MapPin className="h-5 w-5" />
              </span>
              <span className="flex-1 text-[15px] font-medium text-ink">
                {t.visitCta}
              </span>
              <span className="text-text-muted">→</span>
            </a>
          )}

          <Link
            data-referral-event="leave_own_click"
            href={reviewPageUrl}
            className="flex w-full items-center gap-4 rounded-2xl border border-border-base bg-paper p-[18px] text-left transition-all hover:translate-x-0.5 hover:bg-cream-deep"
          >
            <span
              className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[10px] bg-cream-deep"
              style={{ color: accent }}
            >
              <ExternalLink className="h-5 w-5" />
            </span>
            <span className="flex-1 text-[15px] font-medium text-ink">
              {t.leaveOwn}
            </span>
            <span className="text-text-muted">→</span>
          </Link>
        </section>

        <p className="pt-4 text-center text-[11px] text-text-muted">
          {t.poweredBy}
        </p>
      </div>

      <ShareReferralTracker
        locationId={location.id}
        advocateRequestId={req.id}
      />
    </main>
  );
}

function darken(hex: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.floor((num & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function appendRefParam(url: string, advocateId: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("ref", advocateId);
    return u.toString();
  } catch {
    // Not a valid URL — fall back to a raw concatenation.
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}ref=${encodeURIComponent(advocateId)}`;
  }
}

function parseHost(referer: string | null | undefined): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).hostname.slice(0, 200);
  } catch {
    return null;
  }
}
