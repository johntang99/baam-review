import type { OfferImageAspect, RewardConfig } from "@/lib/database.types";

export interface ResolvedRewardConfig {
  enabled: boolean;
  /** True when at least the title is set — without a title we can't render. */
  hasReward: boolean;
  title: string | null;
  subtitle: string | null;
  code: string | null;
  imageUrl: string | null;
  imageAspect: OfferImageAspect;
  description: string | null;
  bookingEnabled: boolean;
  /** Resolved booking URL — reward_config.booking_url override, or locations.booking_url. */
  bookingUrl: string | null;
  /** Custom booking CTA label, or null to use the localized default. */
  bookingCtaLabel: string | null;
  accentColor: string;
  expiresAt: string | null;
  isExpired: boolean;
}

const VALID_ASPECTS: OfferImageAspect[] = [
  "16:9",
  "4:3",
  "1:1",
  "21:9",
  "3:4",
];

function isValidAspect(x: unknown): x is OfferImageAspect {
  return typeof x === "string" && (VALID_ASPECTS as string[]).includes(x);
}

const DEFAULT_ACCENT = "#C9A961"; // gold — differentiates reward from referral
const TITLE_MAX = 100;
const SUBTITLE_MAX = 240;
const CODE_MAX = 30;
const DESCRIPTION_MAX = 1500;
const BOOKING_LABEL_MAX = 80;

export function resolveRewardConfig(
  raw: RewardConfig | null | undefined,
  bookingFallback: string | null,
): ResolvedRewardConfig {
  const c = raw ?? {};
  // Default OFF — reward card only shows when a business explicitly enables it
  // AND fills in a title. (Referral defaults ON; reward is opt-in.)
  const enabled = c.enabled === true;
  const title = cleanString(c.title, TITLE_MAX);
  const subtitle = cleanString(c.subtitle, SUBTITLE_MAX);
  const code = cleanCode(c.code);
  const imageUrl = cleanUrl(c.image_url);
  const description = cleanString(c.description, DESCRIPTION_MAX);
  const bookingEnabled = c.booking_enabled !== false; // default true
  const bookingUrl = cleanUrl(c.booking_url) ?? bookingFallback;
  const bookingCtaLabel = cleanString(c.booking_cta_label, BOOKING_LABEL_MAX);
  const accentColor =
    typeof c.accent_color === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(c.accent_color.trim())
      ? c.accent_color.trim()
      : DEFAULT_ACCENT;
  const expiresAt = cleanIso(c.expires_at);
  const isExpired = expiresAt
    ? new Date(expiresAt).getTime() < Date.now()
    : false;
  const imageAspect = isValidAspect(c.image_aspect) ? c.image_aspect : "4:3";

  return {
    enabled,
    hasReward: enabled && !!title,
    title,
    subtitle,
    code,
    imageUrl,
    imageAspect,
    description,
    bookingEnabled,
    bookingUrl: bookingEnabled ? bookingUrl : null,
    bookingCtaLabel: bookingEnabled ? bookingCtaLabel : null,
    accentColor,
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
