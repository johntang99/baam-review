import type { ReferralConfig } from "@/lib/database.types";

export interface ResolvedReferralConfig {
  enabled: boolean;
  /** True when at least the title is set — the offer block needs a title to render. */
  hasOffer: boolean;
  offerTitle: string | null;
  offerSubtitle: string | null;
  offerCode: string | null;
  offerImageUrl: string | null;
  ctaLabel: string;
  /** Falls back to the location's booking_url when null. */
  ctaUrl: string | null;
  /** ISO date string, or null if no expiry. */
  expiresAt: string | null;
  /** True when expires_at is in the past (offer should still render but with an "expired" pill). */
  isExpired: boolean;
}

const DEFAULT_CTA_LABEL = "Book with this offer";
const TITLE_MAX = 80;
const SUBTITLE_MAX = 240;
const CODE_MAX = 30;
const CTA_LABEL_MAX = 60;

/**
 * Resolve the saved JSON config into a render-safe shape with sane defaults
 * and trimmed/clamped strings. Returns enabled=false (no offer block) when
 * the config is empty or explicitly disabled.
 */
export function resolveReferralConfig(
  raw: ReferralConfig | null | undefined,
): ResolvedReferralConfig {
  const c = raw ?? {};
  const enabled = c.enabled !== false; // default true; explicit false hides
  const offerTitle = cleanString(c.offer_title, TITLE_MAX);
  const offerSubtitle = cleanString(c.offer_subtitle, SUBTITLE_MAX);
  const offerCode = cleanCode(c.offer_code);
  const offerImageUrl = cleanUrl(c.offer_image_url);
  const ctaLabel =
    cleanString(c.cta_label, CTA_LABEL_MAX) ?? DEFAULT_CTA_LABEL;
  const ctaUrl = cleanUrl(c.cta_url);
  const expiresAt = cleanIso(c.expires_at);
  const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;

  return {
    enabled,
    hasOffer: enabled && !!offerTitle,
    offerTitle,
    offerSubtitle,
    offerCode,
    offerImageUrl,
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
