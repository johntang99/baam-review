"use client";

import { Calendar, Check, Copy, Gift } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { STRINGS, type Language } from "@/lib/i18n/review";
import type { OfferImageAspect } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { MarkdownLite } from "./markdown-lite";

interface ReviewerRewardCardProps {
  lang: Language;
  reward: {
    title: string;
    subtitle: string | null;
    code: string | null;
    imageUrl: string | null;
    imageAspect: OfferImageAspect;
    description: string | null;
    bookingEnabled: boolean;
    bookingUrl: string | null;
    bookingCtaLabel: string | null;
    accentColor: string;
    expiresAt: string | null;
    isExpired: boolean;
  };
  onBookClick?: () => void;
}

export function ReviewerRewardCard({
  lang,
  reward,
  onBookClick,
}: ReviewerRewardCardProps) {
  const s = STRINGS[lang];
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function handleCopy() {
    if (!reward.code) return;
    try {
      await navigator.clipboard.writeText(reward.code);
    } catch {
      /* ignore */
    }
    setCopied(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 2000);
  }

  const accent = reward.accentColor;
  const accentSoft = withAlpha(accent, 0.12);
  const showBooking = reward.bookingEnabled && !!reward.bookingUrl;
  const showCode = !!reward.code && !reward.isExpired;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border-2 p-5 shadow-sm"
      style={{
        background: `linear-gradient(135deg, ${withAlpha(accent, 0.18)} 0%, ${withAlpha(accent, 0.06)} 60%, var(--color-paper, #FAF6EE) 100%)`,
        borderColor: withAlpha(accent, 0.5),
      }}
    >
      {/* Decorative glow */}
      <div
        className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full blur-2xl"
        style={{ background: withAlpha(accent, 0.3) }}
      />

      {/* Header: icon + title + how-to-redeem subtitle */}
      <div className="relative flex items-start gap-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${accent} 0%, ${darken(accent, 0.15)} 100%)`,
          }}
        >
          <Gift className="h-6 w-6 text-white" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: darken(accent, 0.2) }}
          >
            {s.reward_eyebrow}
          </p>
          <h2 className="mt-0.5 font-display text-[21px] font-medium leading-tight text-ink">
            {reward.title}
          </h2>
          {reward.subtitle && (
            <p className="mt-1 font-display text-[13.5px] italic leading-relaxed text-text-soft">
              {reward.subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Code pill */}
      {showCode && (
        <div
          className="relative mt-4 rounded-xl border-2 border-dashed bg-white/80 p-3"
          style={{ borderColor: withAlpha(accent, 0.6) }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {s.reward_code_label}
              </p>
              <p className="mt-0.5 font-mono text-[20px] font-bold tracking-wider text-ink break-all">
                {reward.code}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                "flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors",
                copied
                  ? "bg-success text-white"
                  : "bg-ink text-paper hover:bg-text",
              )}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {s.reward_copied}
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  {s.reward_copy}
                </>
              )}
            </button>
          </div>
          {reward.expiresAt && !reward.isExpired && (
            <p className="mt-2 text-[11px] text-text-muted">
              {s.reward_expires.replace(
                "{date}",
                formatExpiry(reward.expiresAt, lang),
              )}
            </p>
          )}
        </div>
      )}

      {reward.isExpired && (
        <p
          className="relative mt-4 inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white"
          style={{ background: darken(accent, 0.2) }}
        >
          {s.reward_expired}
        </p>
      )}

      {/* Hero image */}
      {reward.imageUrl && (
        <div
          className="relative mt-4 overflow-hidden rounded-xl border bg-white"
          style={{ borderColor: withAlpha(accent, 0.3) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={reward.imageUrl}
            alt=""
            className="block w-full object-cover"
            style={{
              aspectRatio: reward.imageAspect.replace(":", " / "),
            }}
          />
        </div>
      )}

      {/* Description (markdown-lite, below image) */}
      {reward.description && (
        <div
          className="relative mt-4 rounded-xl bg-white/70 p-3.5"
          style={{
            border: `1px solid ${withAlpha(accent, 0.25)}`,
          }}
        >
          <MarkdownLite text={reward.description} />
        </div>
      )}

      {/* Booking CTA */}
      {showBooking && (
        <a
          href={reward.bookingUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onBookClick}
          className="relative mt-4 flex items-center justify-center gap-2 rounded-xl border-2 bg-white px-4 py-3 text-[14px] font-semibold text-ink transition-colors hover:shadow-sm"
          style={{ borderColor: withAlpha(accent, 0.5), background: accentSoft }}
        >
          <Calendar
            className="h-4 w-4"
            style={{ color: darken(accent, 0.2) }}
          />
          {reward.bookingCtaLabel || s.reward_book_cta}
        </a>
      )}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Color helpers — keep the gradient & soft fills computed from a single hex.
 * ────────────────────────────────────────────────────────────────────────── */
function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return `rgba(201, 169, 97, ${alpha})`;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darken(hex: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.floor(((n >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.floor(((n >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.floor((n & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function formatExpiry(iso: string, lang: Language): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const locale = lang === "zh" ? "zh-CN" : lang === "es" ? "es-ES" : "en-US";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}
