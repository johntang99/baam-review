import type {
  OfferImageAspect,
  ReferralConfig,
} from "@/lib/database.types";

export interface ResolvedReferralConfig {
  enabled: boolean;
  /** True when at least the title is set — the offer block needs a title to render. */
  hasOffer: boolean;
  offerTitle: string | null;
  offerSubtitle: string | null;
  /** Long-form fine print (markdown-lite). Rendered below the code. */
  offerDescription: string | null;
  offerCode: string | null;
  offerImageUrl: string | null;
  /** Aspect ratio of the hero image. Width is fixed by the card; height = width / aspect. */
  offerImageAspect: OfferImageAspect;
  /** Resolved accent — referral_config.accent_color override, or location brand_color fallback. */
  accentColor: string;
  ctaLabel: string;
  /** Falls back to the location's booking_url when null. */
  ctaUrl: string | null;
  /** ISO date string, or null if no expiry. */
  expiresAt: string | null;
  /** True when expires_at is in the past (offer should still render but with an "expired" pill). */
  isExpired: boolean;
}

export const VALID_ASPECTS: OfferImageAspect[] = [
  "16:9",
  "4:3",
  "1:1",
  "21:9",
  "3:4",
];

export function isValidAspect(x: unknown): x is OfferImageAspect {
  return typeof x === "string" && (VALID_ASPECTS as string[]).includes(x);
}

const DEFAULT_CTA_LABEL = "Book with this offer";
const TITLE_MAX = 80;
const SUBTITLE_MAX = 240;
const DESCRIPTION_MAX = 1500;
const CODE_MAX = 30;
const CTA_LABEL_MAX = 60;

/**
 * Resolve the saved JSON config into a render-safe shape with sane defaults
 * and trimmed/clamped strings. Returns enabled=false (no offer block) when
 * the config is empty or explicitly disabled.
 *
 * Pass the location's brand_color as `fallbackAccent` — used when the
 * referral config doesn't override accent.
 */
export function resolveReferralConfig(
  raw: ReferralConfig | null | undefined,
  fallbackAccent: string,
): ResolvedReferralConfig {
  const c = raw ?? {};
  const enabled = c.enabled !== false; // default true; explicit false hides
  const offerTitle = cleanString(c.offer_title, TITLE_MAX);
  const offerSubtitle = cleanString(c.offer_subtitle, SUBTITLE_MAX);
  const offerDescription = cleanString(c.offer_description, DESCRIPTION_MAX);
  const offerCode = cleanCode(c.offer_code);
  const offerImageUrl = cleanUrl(c.offer_image_url);
  const accentColor =
    typeof c.accent_color === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(c.accent_color.trim())
      ? c.accent_color.trim()
      : fallbackAccent;
  const ctaLabel =
    cleanString(c.cta_label, CTA_LABEL_MAX) ?? DEFAULT_CTA_LABEL;
  const ctaUrl = cleanUrl(c.cta_url);
  const expiresAt = cleanIso(c.expires_at);
  const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;

  const offerImageAspect = isValidAspect(c.offer_image_aspect)
    ? c.offer_image_aspect
    : "16:9";

  return {
    enabled,
    hasOffer: enabled && !!offerTitle,
    offerTitle,
    offerSubtitle,
    offerDescription,
    offerCode,
    offerImageUrl,
    offerImageAspect,
    accentColor,
    ctaLabel,
    ctaUrl,
    expiresAt,
    isExpired,
  };
}

function cleanString(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t ? t.slice(0, max) : null;
}

function cleanCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase()
    .slice(0, CODE_MAX);
  return t || null;
}

function cleanUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  // Allow https:// (and protocol-relative // for flexibility). Reject obvious
  // malformed values.
  if (!/^https?:\/\//i.test(t)) return null;
  return t.slice(0, 600);
}

function cleanIso(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  const d = new Date(t);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Compose the final booking URL the friend lands on. Appends ?code= when an
 * offer code is configured so the booking platform can pre-fill it.
 */
export function buildCtaUrl(
  cfg: ResolvedReferralConfig,
  bookingFallback: string | null,
  advocateRequestId: string | null,
): string | null {
  const base = cfg.ctaUrl || bookingFallback;
  if (!base) return null;
  try {
    const u = new URL(base);
    if (cfg.offerCode) u.searchParams.set("code", cfg.offerCode);
    if (advocateRequestId) u.searchParams.set("ref", advocateRequestId);
    return u.toString();
  } catch {
    return base;
  }
}
