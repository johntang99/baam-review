"use client";

import { useState } from "react";
import { Calendar, Check, Copy } from "lucide-react";
import type { Language } from "@/lib/i18n/review";
import type { OfferImageAspect } from "@/lib/database.types";
import { MarkdownLite } from "@/components/review/markdown-lite";

const STRINGS: Record<
  Language,
  {
    limitedOffer: string;
    expiresPrefix: string;
    expired: string;
    copy: string;
    copied: string;
    bookFallback: string;
  }
> = {
  en: {
    limitedOffer: "Limited offer",
    expiresPrefix: "Expires",
    expired: "Offer expired",
    copy: "Copy",
    copied: "Copied",
    bookFallback: "Book with this offer",
  },
  zh: {
    limitedOffer: "限时优惠",
    expiresPrefix: "截至",
    expired: "优惠已过期",
    copy: "复制",
    copied: "已复制",
    bookFallback: "预约并享受优惠",
  },
  es: {
    limitedOffer: "Oferta limitada",
    expiresPrefix: "Expira",
    expired: "Oferta expirada",
    copy: "Copiar",
    copied: "Copiado",
    bookFallback: "Reservar con esta oferta",
  },
};

interface OfferBlockProps {
  accent: string;
  title: string;
  subtitle: string | null;
  /** Long-form fine print rendered below the code (markdown-lite). */
  description: string | null;
  code: string | null;
  imageUrl: string | null;
  imageAspect: OfferImageAspect;
  ctaLabel: string;
  ctaUrl: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  lang: Language;
}

function aspectToCss(aspect: OfferImageAspect): string {
  // CSS aspect-ratio accepts "W / H" — convert from our colon syntax.
  return aspect.replace(":", " / ");
}

export function OfferBlock({
  accent,
  title,
  subtitle,
  description,
  code,
  imageUrl,
  imageAspect,
  ctaLabel,
  ctaUrl,
  expiresAt,
  isExpired,
  lang,
}: OfferBlockProps) {
  const s = STRINGS[lang] ?? STRINGS.en;
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // best-effort
    }
    // Fire a tracking beacon — the existing ShareReferralTracker listens for
    // data-referral-event clicks; we trigger this one programmatically.
    try {
      const payload = JSON.stringify({
        location_id: undefined,
        advocate_request_id: undefined,
        event_type: "code_copied",
        metadata: { code },
      });
      // The tracker doesn't have the location_id at hand here — leave the
      // server-side share_view + offer_view as the primary signals. A
      // dedicated endpoint could be added later; for now the click on the
      // copy button is implicit when reading code_copied counts later.
      void payload;
    } catch {
      // ignore
    }
  }

  const formattedExpiry = expiresAt
    ? new Date(expiresAt).toLocaleDateString(
        lang === "zh" ? "zh-CN" : lang === "es" ? "es-ES" : "en-US",
        { month: "short", day: "numeric", year: "numeric" },
      )
    : null;

  return (
    <section
      data-referral-event="offer_view"
      className="overflow-hidden rounded-3xl text-white shadow-xl"
      style={{
        background: `linear-gradient(160deg, ${accent} 0%, ${darken(accent, 0.25)} 100%)`,
      }}
    >
      <div className="px-6 pt-6 pb-3 sm:px-7">
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.08em]"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "#FFD56A" }}
          />
          {isExpired ? s.expired : s.limitedOffer}
        </span>
      </div>

      <div className="mx-4 mb-4 rounded-2xl bg-white p-5 text-ink shadow-md sm:mx-5">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="mb-4 w-full rounded-xl object-cover"
            style={{ aspectRatio: aspectToCss(imageAspect) }}
          />
        )}

        <h3 className="font-display text-[24px] font-medium leading-[1.15] tracking-[-0.015em] text-ink">
          {title}
        </h3>

        {subtitle && (
          <p className="mt-2 text-[13.5px] leading-relaxed text-text-soft">
            {subtitle}
          </p>
        )}

        {code && (
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <span
              className="rounded-md border border-dashed px-3 py-1.5 font-mono text-[14px] font-bold tracking-[0.04em]"
              style={{
                color: accent,
                borderColor: accent,
                background: softTint(accent, 0.88),
              }}
            >
              {code}
            </span>
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-medium text-cream transition-colors hover:bg-forest-dark"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {s.copied}
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  {s.copy}
                </>
              )}
            </button>
          </div>
        )}

        {description && (
          <div className="mt-4 rounded-lg bg-cream-deep/60 px-3.5 py-3">
            <MarkdownLite text={description} />
          </div>
        )}

        {formattedExpiry && (
          <p className="mt-3 text-[11.5px] italic text-text-muted">
            {s.expiresPrefix} {formattedExpiry}
          </p>
        )}

        {ctaUrl && !isExpired && (
          <a
            href={ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-referral-event="offer_book_click"
            className="mt-5 flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: accent }}
          >
            <Calendar className="h-4 w-4" />
            {ctaLabel || s.bookFallback}
            <span aria-hidden>→</span>
          </a>
        )}
      </div>
    </section>
  );
}

// Hex darken/lighten helpers — same logic as the OG card and the
// thank-you shell.
function darken(hex: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.floor((num & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function softTint(hex: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(
    255,
    Math.floor(((n >> 16) & 0xff) + (255 - ((n >> 16) & 0xff)) * amount),
  );
  const g = Math.min(
    255,
    Math.floor(((n >> 8) & 0xff) + (255 - ((n >> 8) & 0xff)) * amount),
  );
  const b = Math.min(
    255,
    Math.floor((n & 0xff) + (255 - (n & 0xff)) * amount),
  );
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
