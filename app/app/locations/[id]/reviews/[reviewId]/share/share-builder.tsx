"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink } from "lucide-react";
import {
  SHARE_SIZES,
  SHARE_THEME_LIST,
  type ShareSize,
  type ShareThemeKey,
} from "@/lib/share/themes";
import { cn } from "@/lib/utils";
import { logShareEvent } from "./actions";

interface ShareBuilderProps {
  appUrl: string;
  locationId: string;
  locationName: string;
  brandColor: string;
  defaultTheme: string;
  review: {
    id: string;
    googleReviewId: string;
    reviewerName: string | null;
    rating: number;
    comment: string | null;
    createdAt: string;
  };
}

export function ShareBuilder({
  appUrl,
  locationId,
  locationName,
  brandColor,
  defaultTheme,
  review,
}: ShareBuilderProps) {
  const [size, setSize] = useState<ShareSize>("og");
  const [theme, setTheme] = useState<ShareThemeKey>(
    (defaultTheme as ShareThemeKey) ?? "warm-clinic",
  );
  const [copied, setCopied] = useState(false);

  // For the live preview, render from the current admin origin (so localhost
  // dev sees its own freshly-edited /og/review route). The "Copy image URL"
  // action still uses the canonical prod URL since that's what customers
  // will share externally.
  const [previewOrigin, setPreviewOrigin] = useState(appUrl);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPreviewOrigin(window.location.origin);
    }
  }, []);

  // Canonical (prod) URL — used by Copy + Download + Open actions.
  const imgUrl = useMemo(() => {
    const u = new URL(`${appUrl}/og/review/${review.googleReviewId}`);
    u.searchParams.set("size", size);
    u.searchParams.set("theme", theme);
    return u.toString();
  }, [appUrl, review.googleReviewId, size, theme]);

  // Preview URL — same shape but origin-relative and cache-busted so a fresh
  // deploy (or local code change) shows immediately.
  const previewSrc = useMemo(() => {
    const u = new URL(`${previewOrigin}/og/review/${review.googleReviewId}`);
    u.searchParams.set("size", size);
    u.searchParams.set("theme", theme);
    return u.toString();
  }, [previewOrigin, review.googleReviewId, size, theme]);

  function fileName(): string {
    const slugName = locationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40);
    return `${slugName || "review"}-${review.rating}star-${size}-${theme}.png`;
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(imgUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // best-effort
    }
    void logShareEvent({
      locationId,
      googleReviewId: review.googleReviewId,
      size,
      theme,
      action: "copy_url",
    });
  }

  async function download() {
    void logShareEvent({
      locationId,
      googleReviewId: review.googleReviewId,
      size,
      theme,
      action: "download",
    });
    try {
      const res = await fetch(imgUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // Fallback: just open in new tab.
      window.open(imgUrl, "_blank", "noopener,noreferrer");
    }
  }

  function openInTab() {
    void logShareEvent({
      locationId,
      googleReviewId: review.googleReviewId,
      size,
      theme,
      action: "open",
    });
    window.open(imgUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_440px]">
      <div className="space-y-7">
        {/* Review summary */}
        <section className="rounded-2xl border border-border-base bg-cream-deep p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[14px] tracking-[2px] text-gold">
              {"★".repeat(review.rating)}
              <span className="opacity-25">{"★".repeat(5 - review.rating)}</span>
            </span>
            <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
              {new Date(review.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <p className="line-clamp-5 text-[14px] leading-relaxed text-text">
            {review.comment ?? "(No comment text)"}
          </p>
          <p className="mt-2 text-[12px] text-text-muted">
            — {review.reviewerName ?? "Verified customer"}
          </p>
        </section>

        {/* Theme picker */}
        <div className="space-y-2.5">
          <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
            Theme
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SHARE_THEME_LIST.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTheme(t.key)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  theme === t.key
                    ? "border-forest bg-forest/[0.04]"
                    : "border-border-base bg-paper hover:bg-hover",
                )}
              >
                <span
                  className="h-10 w-10 flex-shrink-0 rounded-md"
                  style={{ background: t.background(brandColor) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-ink">{t.label}</p>
                  <p className="text-[11.5px] text-text-soft">{t.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Size picker */}
        <div className="space-y-2.5">
          <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
            Size
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(SHARE_SIZES) as ShareSize[]).map((s) => {
              const meta = SHARE_SIZES[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    size === s
                      ? "border-forest bg-forest/[0.04]"
                      : "border-border-base bg-paper hover:bg-hover",
                  )}
                >
                  <p className="text-[13.5px] font-medium text-ink">
                    {meta.label}
                  </p>
                  <p className="font-mono text-[11px] text-text-muted">
                    {meta.width}×{meta.height}
                  </p>
                  <p className="mt-1.5 text-[11px] text-text-soft leading-snug">
                    {meta.usage}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border-base pt-5">
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-[14px] font-medium text-cream transition-all hover:-translate-y-px hover:bg-forest-dark"
          >
            <Download className="h-4 w-4" />
            Download PNG
          </button>
          <button
            type="button"
            onClick={copyUrl}
            className="inline-flex items-center gap-2 rounded-full border border-border-base bg-paper px-5 py-2.5 text-[14px] font-medium text-text transition-colors hover:bg-hover"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-success" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy image URL
              </>
            )}
          </button>
          <button
            type="button"
            onClick={openInTab}
            className="inline-flex items-center gap-2 rounded-full border border-border-base bg-paper px-5 py-2.5 text-[14px] font-medium text-text transition-colors hover:bg-hover"
          >
            <ExternalLink className="h-4 w-4" />
            Open in new tab
          </button>
        </div>
      </div>

      {/* Preview */}
      <aside className="space-y-3">
        <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
          Live preview
        </p>
        <div className="rounded-2xl border border-border-base bg-cream-deep/40 p-4">
          {/* The img element forces a fresh fetch when params change. Long
              cache headers on the route mean repeat previews are cheap. */}
          <div
            className="overflow-hidden rounded-xl bg-paper"
            style={{
              aspectRatio:
                size === "og" ? "1200/630" : size === "square" ? "1/1" : "9/16",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={previewSrc}
              src={previewSrc}
              alt="Share-card preview"
              className="h-full w-full object-cover"
              onLoad={() =>
                logShareEvent({
                  locationId,
                  googleReviewId: review.googleReviewId,
                  size,
                  theme,
                  action: "view",
                })
              }
            />
          </div>
        </div>
        <p className="text-center text-[11.5px] text-text-muted">
          {SHARE_SIZES[size].usage}
        </p>
      </aside>
    </div>
  );
}
