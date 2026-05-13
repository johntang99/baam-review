"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Share2,
  Sparkles,
  Smartphone,
  Send,
} from "lucide-react";
import {
  SHARE_SIZES,
  SHARE_THEME_LIST,
  type ShareSize,
  type ShareThemeKey,
} from "@/lib/share/themes";
import { cn } from "@/lib/utils";
import { logShareEvent, setDefaultShareTheme } from "./actions";

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
  const [lang, setLang] = useState<"en" | "zh" | "es">("en");
  const [copied, setCopied] = useState(false);

  // Caption state
  const [captionPlatform, setCaptionPlatform] = useState<
    "instagram" | "xiaohongshu" | "facebook" | "wechat"
  >("instagram");
  const [caption, setCaption] = useState<string>("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [captioning, setCaptioning] = useState(false);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [captionCopied, setCaptionCopied] = useState(false);

  // Default theme save state
  const [savingDefault, setSavingDefault] = useState(false);
  const [savedDefaultAt, setSavedDefaultAt] = useState<number | null>(null);

  // GBP post state
  const [posting, setPosting] = useState(false);
  const [postedAt, setPostedAt] = useState<number | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  // Mobile native share state — detected after hydration so SSR is stable.
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      setCanNativeShare(true);
    }
  }, []);


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
    u.searchParams.set("lang", lang);
    return u.toString();
  }, [appUrl, review.googleReviewId, size, theme, lang]);

  // Preview URL — same shape but origin-relative and cache-busted so a fresh
  // deploy (or local code change) shows immediately.
  const previewSrc = useMemo(() => {
    const u = new URL(`${previewOrigin}/og/review/${review.googleReviewId}`);
    u.searchParams.set("size", size);
    u.searchParams.set("theme", theme);
    u.searchParams.set("lang", lang);
    return u.toString();
  }, [previewOrigin, review.googleReviewId, size, theme, lang]);

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

  async function saveAsDefault() {
    setSavingDefault(true);
    const res = await setDefaultShareTheme(locationId, theme);
    setSavingDefault(false);
    if (res.ok) setSavedDefaultAt(Date.now());
  }

  async function generateCaption() {
    setCaptioning(true);
    setCaptionError(null);
    try {
      const res = await fetch("/api/share/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          google_review_id: review.googleReviewId,
          platform: captionPlatform,
          language: lang,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as {
        caption: string;
        hashtags: string[];
      };
      setCaption(j.caption);
      setHashtags(j.hashtags);
    } catch (e) {
      setCaptionError(
        e instanceof Error ? e.message : "Couldn't generate caption",
      );
    } finally {
      setCaptioning(false);
    }
  }

  async function copyCaption() {
    const fullText = hashtags.length
      ? `${caption}\n\n${hashtags.join(" ")}`
      : caption;
    try {
      await navigator.clipboard.writeText(fullText);
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2000);
    } catch {
      // best-effort
    }
  }

  async function postToGbp() {
    setPosting(true);
    setPostError(null);
    try {
      const res = await fetch("/api/share/post-to-gbp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          google_review_id: review.googleReviewId,
          caption: caption || "",
          theme,
          size: size === "story" ? "square" : size,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setPostedAt(Date.now());
    } catch (e) {
      setPostError(
        e instanceof Error ? e.message : "Couldn't post to Google",
      );
    } finally {
      setPosting(false);
    }
  }

  async function nativeShare() {
    try {
      // Fetch the image as a Blob so we can pass it as a File to navigator.share.
      // iOS Safari supports File[]; Android Chrome supports it too.
      const res = await fetch(imgUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName(), { type: blob.type });
      const shareData: ShareData = {
        files: [file],
        title: locationName,
        text: caption || `${review.rating}★ from ${review.reviewerName ?? "a customer"} — ${locationName}`,
      };
      if (navigator.canShare && !navigator.canShare(shareData)) {
        // Fallback: share text + URL only when file sharing isn't supported.
        await navigator.share({
          title: locationName,
          text: caption,
          url: imgUrl,
        });
      } else {
        await navigator.share(shareData);
      }
      void logShareEvent({
        locationId,
        googleReviewId: review.googleReviewId,
        size,
        theme,
        action: "open",
      });
    } catch {
      // User dismissed share sheet — no-op
    }
  }

  const isDesktop = !canNativeShare;

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
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
              Theme
            </p>
            <button
              type="button"
              onClick={saveAsDefault}
              disabled={savingDefault}
              className="inline-flex items-center gap-1 text-[11.5px] text-forest transition-colors hover:underline disabled:opacity-50"
            >
              {savingDefault
                ? "Saving…"
                : savedDefaultAt
                  ? "✓ Saved as default"
                  : "Save as default for this location"}
            </button>
          </div>
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

        {/* Language toggle */}
        <div className="space-y-2.5">
          <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
            Caption language
          </p>
          <div className="inline-flex rounded-full border border-border-base bg-paper p-1">
            {(
              [
                { v: "en", label: "EN" },
                { v: "zh", label: "中文" },
                { v: "es", label: "ES" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setLang(opt.v)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-[13px] font-medium transition-all",
                  lang === opt.v
                    ? "bg-ink text-cream"
                    : "bg-transparent text-text-soft hover:text-ink",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11.5px] text-text-muted">
            Sets the share-card&apos;s comment variant (translated vs original)
            and the AI caption language below.
          </p>
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

        {/* AI caption panel */}
        <section className="space-y-2.5 rounded-2xl border border-border-base bg-paper p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-medium text-ink">
              AI-drafted caption + hashtags
            </p>
            <div className="inline-flex rounded-full bg-cream-deep p-1 text-[11.5px]">
              {(
                [
                  { v: "instagram", label: "IG" },
                  { v: "xiaohongshu", label: "小红书" },
                  { v: "facebook", label: "FB" },
                  { v: "wechat", label: "微信" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setCaptionPlatform(opt.v)}
                  className={cn(
                    "rounded-full px-3 py-1 font-medium transition-colors",
                    captionPlatform === opt.v
                      ? "bg-ink text-cream"
                      : "text-text-soft hover:text-ink",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={
              caption
                ? hashtags.length
                  ? `${caption}\n\n${hashtags.join(" ")}`
                  : caption
                : ""
            }
            onChange={(e) => {
              // Edits to the textarea drop the hashtag/caption split — treat
              // anything in the box as the final caption text the owner wants.
              setCaption(e.target.value);
              setHashtags([]);
            }}
            rows={6}
            placeholder={
              captioning
                ? "Drafting…"
                : "Click Generate to draft a caption for the chosen platform."
            }
            className="w-full rounded-lg border border-border-base bg-cream-deep px-3 py-2.5 font-serif text-[14px] leading-relaxed text-text shadow-sm focus:border-forest focus:outline-none"
          />

          {captionError && (
            <p role="alert" className="text-[12.5px] text-alert">
              {captionError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={generateCaption}
              disabled={captioning}
              className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-[13.5px] font-medium text-cream transition-all hover:-translate-y-px hover:bg-forest-dark disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {captioning
                ? "Drafting…"
                : caption
                  ? "Re-draft"
                  : "Generate"}
            </button>
            <button
              type="button"
              onClick={copyCaption}
              disabled={!caption}
              className="inline-flex items-center gap-2 rounded-full border border-border-base bg-paper px-4 py-2 text-[13.5px] font-medium text-text transition-colors hover:bg-hover disabled:opacity-50"
            >
              {captionCopied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success" />
                  Caption copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy caption
                </>
              )}
            </button>
          </div>
        </section>

        {/* Post directly to GBP */}
        <section className="space-y-2.5 rounded-2xl border border-border-base bg-gold-soft/30 p-5">
          <div>
            <p className="text-[13px] font-medium text-ink">
              Post directly to Google Business Profile
            </p>
            <p className="mt-1 text-[12px] text-text-soft">
              Posts a square version of this share card with the caption as
              the body. Appears on your Google listing within minutes. Uses
              your connected Google account; no extra steps.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={postToGbp}
              disabled={posting || !caption}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13.5px] font-medium text-cream transition-all hover:-translate-y-px hover:bg-forest-dark disabled:opacity-50"
              title={!caption ? "Generate a caption first" : "Post to GBP"}
            >
              <Send className="h-3.5 w-3.5" />
              {posting
                ? "Posting…"
                : postedAt
                  ? "✓ Posted to Google"
                  : "Post to Google"}
            </button>
            {postError && (
              <p role="alert" className="text-[12.5px] text-alert">
                {postError}
              </p>
            )}
          </div>
        </section>

        {/* Image actions — desktop downloads + mobile native share */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border-base pt-5">
          {canNativeShare && (
            <button
              type="button"
              onClick={nativeShare}
              className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-[14px] font-medium text-cream transition-all hover:-translate-y-px hover:bg-forest-dark"
            >
              <Share2 className="h-4 w-4" />
              Share to app
            </button>
          )}
          <button
            type="button"
            onClick={download}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-medium transition-all hover:-translate-y-px",
              canNativeShare
                ? "border border-border-base bg-paper text-text hover:bg-hover"
                : "bg-forest text-cream hover:bg-forest-dark",
            )}
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

        {/* Desktop QR handoff — scan to continue on phone */}
        {isDesktop && <QrHandoff />}
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

/**
 * Renders a QR code containing the current page URL so an admin on desktop
 * can scan with their phone and continue the share flow there. Mobile share
 * sheets can hand the image directly to Instagram / Xiaohongshu / WeChat —
 * something we can't do from desktop browsers.
 */
function QrHandoff() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      try {
        const QR = await import("qrcode");
        const png = await QR.toDataURL(window.location.href, {
          margin: 1,
          width: 240,
          color: { dark: "#0F1F1A", light: "#FFFFFF" },
        });
        if (!cancelled) setDataUrl(png);
      } catch {
        // Best-effort — silently no-op if qrcode fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!dataUrl) return null;

  return (
    <section className="flex items-center gap-4 rounded-2xl border border-border-base bg-paper p-4">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-cream-deep text-text-soft">
        <Smartphone className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink">Continue on phone</p>
        <p className="text-[11.5px] text-text-soft">
          Scan to share directly to Instagram / Xiaohongshu / WeChat via your
          phone&apos;s native share sheet.
        </p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt="QR code to continue on phone"
        className="h-20 w-20 flex-shrink-0 rounded-md"
      />
    </section>
  );
}
