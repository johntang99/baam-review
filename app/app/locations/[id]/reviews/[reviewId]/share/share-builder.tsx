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
    reviewerPhotoUrl: string | null;
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
    "instagram" | "facebook" | "twitter" | "linkedin"
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
    // Fetch from the SAME origin (previewSrc) — the canonical prod URL
    // (imgUrl) would be cross-origin from localhost and CORS-blocked. Same
    // image content either way since both hit the OG route with identical
    // query params.
    try {
      const res = await fetch(previewSrc);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName();
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error("download failed", err);
      // Fallback: open in a new tab so the user can right-click → Save As.
      window.open(previewSrc, "_blank", "noopener,noreferrer");
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

  // Helper — fetch the rendered image as a Blob (same-origin to avoid CORS).
  async function fetchImageBlob(): Promise<Blob | null> {
    try {
      const res = await fetch(previewSrc);
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  }

  function captionPlusUrl(): string {
    if (!caption) return imgUrl;
    return hashtags.length
      ? `${caption}\n\n${hashtags.join(" ")}\n\n${imgUrl}`
      : `${caption}\n\n${imgUrl}`;
  }

  function logOpen() {
    void logShareEvent({
      locationId,
      googleReviewId: review.googleReviewId,
      size,
      theme,
      action: "open",
    });
  }

  // — Platform handlers —

  function shareFacebook() {
    logOpen();
    const u = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(imgUrl)}&quote=${encodeURIComponent(caption || "")}`;
    window.open(u, "_blank", "noopener,noreferrer,width=626,height=436");
  }

  function shareTwitter() {
    logOpen();
    const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption || "")}&url=${encodeURIComponent(imgUrl)}`;
    window.open(u, "_blank", "noopener,noreferrer,width=550,height=420");
  }

  function shareLinkedin() {
    logOpen();
    const u = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(imgUrl)}`;
    window.open(u, "_blank", "noopener,noreferrer,width=600,height=520");
  }

  function shareWhatsApp() {
    logOpen();
    const u = `https://wa.me/?text=${encodeURIComponent(captionPlusUrl())}`;
    window.open(u, "_blank", "noopener,noreferrer");
  }

  function shareMessages() {
    logOpen();
    // iOS / macOS pick this up as iMessage; other platforms fall through to
    // whatever SMS client is registered.
    window.location.href = `sms:?&body=${encodeURIComponent(captionPlusUrl())}`;
  }

  function shareEmail() {
    logOpen();
    const subject = `${review.rating}★ review of ${locationName}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(captionPlusUrl())}`;
  }

  async function copyTextAndImage() {
    const text = caption
      ? hashtags.length
        ? `${caption}\n\n${hashtags.join(" ")}`
        : caption
      : `${review.rating}★ review of ${locationName}`;

    const blob = await fetchImageBlob();

    // Try image + text on clipboard via ClipboardItem. If unsupported
    // (Safari sometimes refuses image/png + text together), fall back to
    // text-only. The image is on the clipboard only when both succeed.
    try {
      if (blob && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob,
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      await navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyLinkAndCaption() {
    await navigator.clipboard.writeText(captionPlusUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function nativeShare() {
    try {
      const blob = await fetchImageBlob();
      const text =
        caption ||
        `${review.rating}★ from ${review.reviewerName ?? "a customer"} — ${locationName}`;
      if (blob) {
        const file = new File([blob], fileName(), { type: blob.type });
        const shareData: ShareData = {
          files: [file],
          title: locationName,
          text,
        };
        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          logOpen();
          return;
        }
      }
      // Fallback when file sharing is unavailable (some desktop browsers).
      await navigator.share({
        title: locationName,
        text,
        url: imgUrl,
      });
      logOpen();
    } catch {
      // User dismissed share sheet — no-op.
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
          <div className="mt-3 flex items-center gap-2">
            {review.reviewerPhotoUrl &&
            isSafeGooglePhotoUrl(review.reviewerPhotoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={review.reviewerPhotoUrl}
                alt=""
                width={22}
                height={22}
                referrerPolicy="no-referrer"
                className="h-[22px] w-[22px] flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-forest/15 text-[10px] font-semibold text-forest">
                {(review.reviewerName ?? "?").charAt(0).toUpperCase()}
              </span>
            )}
            <p className="text-[12px] text-text-muted">
              — {review.reviewerName ?? "Verified customer"}
            </p>
          </div>
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
                  { v: "facebook", label: "FB" },
                  { v: "twitter", label: "X" },
                  { v: "linkedin", label: "LinkedIn" },
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

        {/* Share targets — 4-col icon grid, mirrors prototype 07's share-row */}
        <section className="space-y-3 border-t border-border-base pt-5">
          <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
            Share to
          </p>
          <div className="grid grid-cols-4 gap-2">
            <ShareTile
              label="Facebook"
              hint="Web share"
              bg="#1877F2"
              onClick={shareFacebook}
              icon={<FacebookGlyph />}
            />
            <ShareTile
              label="X"
              hint="Tweet"
              bg="#0F1419"
              onClick={shareTwitter}
              icon={<XGlyph />}
            />
            <ShareTile
              label="LinkedIn"
              hint="Web share"
              bg="#0A66C2"
              onClick={shareLinkedin}
              icon={<LinkedinGlyph />}
            />
            <ShareTile
              label="WhatsApp"
              hint="Send link"
              bg="#25D366"
              onClick={shareWhatsApp}
              icon={<WhatsAppGlyph />}
            />
            <ShareTile
              label="Messages"
              hint="SMS / iMessage"
              bg="#1F4D3F"
              onClick={shareMessages}
              icon={<MessagesGlyph />}
            />
            <ShareTile
              label="Email"
              hint="With image link"
              bg="#5A6660"
              onClick={shareEmail}
              icon={<MailGlyph />}
            />
            <ShareTile
              label="Copy"
              hint="Text + image"
              bg="#0F1F1A"
              onClick={copyTextAndImage}
              icon={
                copied ? (
                  <Check className="h-[18px] w-[18px]" />
                ) : (
                  <Copy className="h-[18px] w-[18px]" />
                )
              }
            />
            <ShareTile
              label="Link"
              hint="Text + URL"
              bg="#0F1F1A"
              onClick={copyLinkAndCaption}
              icon={<LinkGlyph />}
            />
          </div>

          {canNativeShare && (
            <button
              type="button"
              onClick={nativeShare}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest px-5 py-2.5 text-[14px] font-medium text-cream transition-all hover:-translate-y-px hover:bg-forest-dark"
            >
              <Share2 className="h-4 w-4" />
              More apps…
            </button>
          )}
        </section>

        {/* Other actions: download + open */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-2 rounded-full border border-border-base bg-paper px-5 py-2.5 text-[14px] font-medium text-text transition-colors hover:bg-hover"
          >
            <Download className="h-4 w-4" />
            Download PNG
          </button>
          <button
            type="button"
            onClick={copyUrl}
            className="inline-flex items-center gap-2 rounded-full border border-border-base bg-paper px-5 py-2.5 text-[14px] font-medium text-text transition-colors hover:bg-hover"
          >
            <Copy className="h-4 w-4" />
            Copy image URL
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
function isSafeGooglePhotoUrl(u: string | null | undefined): u is string {
  if (!u) return false;
  try {
    const url = new URL(u);
    return (
      url.protocol === "https:" &&
      (url.hostname.endsWith(".googleusercontent.com") ||
        url.hostname.endsWith(".googleapis.com") ||
        url.hostname === "lh3.google.com")
    );
  } catch {
    return false;
  }
}

function ShareTile({
  label,
  hint,
  bg,
  icon,
  onClick,
}: {
  label: string;
  hint: string;
  bg: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-border-base bg-cream-deep px-2 py-3.5 text-center transition-all hover:-translate-y-0.5 hover:bg-paper hover:shadow-sm"
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white"
        style={{ background: bg }}
      >
        {icon}
      </span>
      <span className="text-[12px] font-medium text-text">{label}</span>
      <span className="text-[10.5px] text-text-muted leading-tight">
        {hint}
      </span>
    </button>
  );
}

/* Inline brand glyphs — lucide-react v1.14 dropped most brand logos for
   trademark reasons, so we inline minimal SVG paths. */
function FacebookGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      width="18"
      height="18"
    >
      <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.25-1.5 1.55-1.5H16.7V4.65A22.5 22.5 0 0 0 14.3 4.5c-2.35 0-4 1.45-4 4.1V10.9H7.6V14h2.7v8h3.2z" />
    </svg>
  );
}
function XGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      width="16"
      height="16"
    >
      <path d="M18.244 2H21.5l-7.13 8.158L22.5 22h-6.81l-5.34-6.97L4.18 22H.92l7.63-8.73L1.5 2h6.97l4.84 6.39L18.244 2zm-1.2 18h1.81L7.04 4H5.1l11.944 16z" />
    </svg>
  );
}
function LinkedinGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      width="18"
      height="18"
    >
      <path d="M20.45 20.45h-3.55V14.9c0-1.32-.03-3.02-1.84-3.02-1.84 0-2.12 1.44-2.12 2.92v5.65H9.4V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.21 0 22.23 0z" />
    </svg>
  );
}
function WhatsAppGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      width="18"
      height="18"
    >
      <path d="M17.5 14.4c-.3-.15-1.78-.88-2.05-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.63-.93-2.23-.24-.58-.49-.5-.67-.51-.18-.01-.39-.01-.59-.01-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5 0 1.48 1.08 2.9 1.23 3.1.15.2 2.13 3.25 5.16 4.55.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.08-.13-.28-.2-.58-.35zM12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.06L2 22l5.05-1.36A9.95 9.95 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18a8 8 0 0 1-4.08-1.12l-.29-.17-3 .8.8-2.92-.19-.3A8 8 0 1 1 12 20z" />
    </svg>
  );
}
function MessagesGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width="18"
      height="18"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
function MailGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width="18"
      height="18"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
function LinkGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width="18"
      height="18"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71" />
    </svg>
  );
}

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
