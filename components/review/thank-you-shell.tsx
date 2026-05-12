"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Check,
  Copy,
  MessageSquare,
  Share2,
} from "lucide-react";

// Lucide dropped brand logos for trademark reasons; the Facebook "f" mark
// is small enough to inline.
function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.25-1.5 1.55-1.5H16.7V4.65A22.5 22.5 0 0 0 14.3 4.5c-2.35 0-4 1.45-4 4.1V10.9H7.6V14h2.7v8h3.2z" />
    </svg>
  );
}
import type { Language, SocialHandles } from "@/lib/database.types";
import { STRINGS } from "@/lib/i18n/review";
import { logPostReviewAction } from "@/app/r/[slug]/thank-you/actions";
import { LanguageSwitcher } from "./language-switcher";
import { cn } from "@/lib/utils";

interface ThankYouShellProps {
  lang: Language;
  supportedLangs: Language[];
  location: {
    id: string;
    slug: string;
    displayName: string;
    brandColor: string;
    logoUrl: string | null;
    address: string | null;
    bookingUrl: string | null;
    socialHandles: SocialHandles;
  };
  recipientFirstName: string | null;
  requestId: string | null;
  rating: number;
  consentDisplay: boolean;
  shareToken: string | null;
  shareUrl: string | null;
  shareImageUrl: string | null;
  isPrivate: boolean;
  shareablePreviewQuote: string;
}

export function ThankYouShell(props: ThankYouShellProps) {
  const {
    lang,
    supportedLangs,
    location,
    recipientFirstName,
    requestId,
    rating,
    consentDisplay,
    shareToken,
    shareUrl,
    shareImageUrl,
    isPrivate,
    shareablePreviewQuote,
  } = props;
  const s = STRINGS[lang];

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const loggedView = useRef(false);

  const accent = location.brandColor || "#1F4D3F";

  // Per-location CSS var driving the prototype's --clinic-primary token.
  // Inline style keeps it scoped to this subtree.
  const accentStyle = {
    "--clinic-primary": accent,
    "--clinic-primary-dark": accent,
  } as React.CSSProperties;

  useEffect(() => {
    if (loggedView.current) return;
    loggedView.current = true;
    void logPostReviewAction({
      locationId: location.id,
      requestId,
      actionType: "view",
      language: lang,
      metadata: { via_private: isPrivate },
    });
  }, [isPrivate, lang, location.id, requestId]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }

  function handleBook() {
    if (!location.bookingUrl) return;
    void logPostReviewAction({
      locationId: location.id,
      requestId,
      actionType: "book_click",
      language: lang,
      metadata: { booking_url: location.bookingUrl },
    });
    showToast(s.toast_book_opening);
    window.open(location.bookingUrl, "_blank", "noopener,noreferrer");
  }

  async function handleShare(destination: "fb" | "sms" | "copy" | "more") {
    void logPostReviewAction({
      locationId: location.id,
      requestId,
      actionType: "share_click",
      shareDestination: destination,
      shareToken,
      language: lang,
    });

    if (!shareUrl) {
      showToast(s.toast_copied);
      return;
    }

    if (destination === "fb") {
      const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
      window.open(fbUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (destination === "sms") {
      window.location.href = `sms:?&body=${encodeURIComponent(
        `${shareablePreviewQuote} ${shareUrl}`,
      )}`;
      return;
    }

    if (
      destination === "more" &&
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({
          title: location.displayName,
          text: shareablePreviewQuote,
          url: shareUrl,
        });
        return;
      } catch {
        // user dismissed — fall through to copy
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(s.toast_copied);
    } catch {
      showToast(s.toast_copied);
    }
  }

  function handleFollow(platform: keyof SocialHandles, url: string) {
    void logPostReviewAction({
      locationId: location.id,
      requestId,
      actionType: "follow_click",
      language: lang,
      metadata: { platform, url },
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleDone() {
    void logPostReviewAction({
      locationId: location.id,
      requestId,
      actionType: "done_click",
      language: lang,
    });
    if (typeof window !== "undefined") {
      window.close();
      // window.close() is no-op on tabs not opened by script — fall back home
      setTimeout(() => {
        window.location.href = `/r/${location.slug}`;
      }, 100);
    }
  }

  const initial = location.displayName.charAt(0).toUpperCase();
  const nameLine = recipientFirstName
    ? s.thanks_title_named.replace("{name}", recipientFirstName)
    : s.thanks_title;
  const subText = isPrivate ? s.thanks_private : s.thanks_sub;
  const eyebrow = isPrivate ? s.thanks_private : s.thanks_eyebrow;

  const hasSocial = Object.values(location.socialHandles ?? {}).some(
    (v) => typeof v === "string" && v.length > 0,
  );
  const showShareCard = consentDisplay && !!shareUrl;

  return (
    <div
      className="mx-auto flex w-full max-w-[480px] flex-col gap-[18px]"
      style={accentStyle}
    >
      {/* Top bar with language switcher */}
      <div className="flex items-center justify-end px-1 pt-2">
        <LanguageSwitcher current={lang} available={supportedLangs} />
      </div>

      {/* Confirmation card */}
      <section className="overflow-hidden rounded-3xl border border-border-base bg-paper shadow-sm">
        <div className="relative overflow-hidden bg-gradient-to-br from-forest to-forest-dark px-[30px] pt-9 pb-8 text-center text-cream">
          <div className="pointer-events-none absolute inset-0 opacity-[0.18]">
            <div className="absolute right-[-20%] top-[-30%] h-[280px] w-[280px] rounded-full bg-gold/30 blur-3xl" />
            <div className="absolute bottom-[-30%] left-[-15%] h-[240px] w-[240px] rounded-full bg-sage/40 blur-3xl" />
          </div>
          <div className="relative">
            <span
              className={cn(
                "mx-auto mb-[18px] flex h-14 w-14 items-center justify-center rounded-full border border-gold bg-gold/20 text-gold",
                "animate-[checkmark-pop_0.5s_cubic-bezier(0.34,1.56,0.64,1)_backwards]",
              )}
            >
              <Check className="h-7 w-7 stroke-[2.5]" />
            </span>
            <p className="mb-2.5 text-[11.5px] font-medium uppercase tracking-[0.16em] text-gold">
              {eyebrow}
            </p>
            <h1 className="font-display text-[32px] font-normal leading-[1.1] tracking-[-0.025em] text-cream">
              {nameLine.split("\n").map((line, i, arr) =>
                i === arr.length - 1 ? (
                  <em key={i} className="not-italic text-gold italic">
                    {line}
                  </em>
                ) : (
                  <span key={i}>
                    {line}
                    <br />
                  </span>
                ),
              )}
            </h1>
            <p className="mx-auto mt-3 max-w-[360px] font-display text-[16px] italic leading-[1.5] text-cream/80">
              {subText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 border-t border-border-soft bg-cream-deep px-6 py-[18px]">
          {location.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={location.logoUrl}
              alt=""
              className="h-11 w-11 rounded-[10px] object-cover shadow-sm"
            />
          ) : (
            <span
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[10px] font-display text-[22px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: accent }}
            >
              {initial}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display text-[16px] font-medium tracking-[-0.01em] text-ink">
              {location.displayName}
            </p>
            <p className="mt-0.5 truncate text-[12.5px] text-text-muted">
              {[location.address, s.thanks_meta_just_now].filter(Boolean).join(" · ")}
            </p>
          </div>
          {!isPrivate && (
            <p className="text-[13px] tracking-[1.5px] text-gold">
              {"★".repeat(Math.max(1, Math.min(5, rating)))}
            </p>
          )}
        </div>
      </section>

      {/* Next steps — only renders when there's an external CTA to surface
          (booking_url). The share card lives in its own section below. */}
      {location.bookingUrl && (
        <section className="overflow-hidden rounded-3xl border border-border-base bg-paper shadow-sm">
          <div className="border-b border-border-soft px-7 pb-[18px] pt-[26px]">
            <p className="mb-2 text-[11.5px] font-medium uppercase tracking-[0.14em] text-text-muted">
              {s.next_eyebrow}
            </p>
            <h2 className="mb-1.5 font-display text-[22px] font-medium leading-[1.2] tracking-[-0.015em] text-ink">
              {s.next_title.replace(s.next_title_em, "")}
              <em className="text-forest">{s.next_title_em}</em>
            </h2>
            <p className="font-display text-[15px] italic text-text-soft">
              {s.next_sub}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 px-[18px] py-[14px] pb-[22px]">
            <ActionButton
              primary
              accent={accent}
              icon={<Calendar className="h-5 w-5" />}
              title={s.book_title}
              desc={s.book_desc}
              onClick={handleBook}
            />
          </div>
        </section>
      )}

      {/* Share card — always visible when consent allows it. */}
      {showShareCard && (
        <section className="overflow-hidden rounded-3xl border border-border-base bg-paper shadow-sm">
          <header className="px-7 pt-[22px]">
            <p className="mb-2 inline-flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-[0.14em] text-gold">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              {s.share_eyebrow}
            </p>
            <h3 className="mb-1 font-display text-[20px] font-medium leading-[1.2] tracking-[-0.015em] text-ink">
              {s.share_title.replace(s.share_title_em, "")}
              <em className="not-italic italic" style={{ color: accent }}>
                {s.share_title_em}
              </em>
            </h3>
            <p className="font-display text-[14.5px] italic leading-snug text-text-soft">
              {s.share_sub}
            </p>
          </header>

          <SharePreview
            accent={accent}
            initial={initial}
            displayName={location.displayName}
            address={location.address}
            rating={rating}
            quote={shareablePreviewQuote}
            attribution={s.share_preview_attribution.replace(
              "{name}",
              recipientFirstName ?? "",
            )}
            mark={s.share_preview_mark}
            shareImageUrl={shareImageUrl}
            businessHref={shareUrl ?? `/r/${location.slug}`}
          />

          <div className="grid grid-cols-4 gap-2.5 p-[22px]">
            <ShareDest
              variant="fb"
              label={s.dest_fb}
              onClick={() => handleShare("fb")}
            />
            <ShareDest
              variant="sms"
              label={s.dest_sms}
              accent={accent}
              onClick={() => handleShare("sms")}
            />
            <ShareDest
              variant="copy"
              label={s.dest_copy}
              onClick={() => handleShare("copy")}
              icon={<Copy className="h-[18px] w-[18px]" />}
            />
            <ShareDest
              variant="more"
              label={s.dest_more}
              onClick={() => handleShare("more")}
              icon={<Share2 className="h-[18px] w-[18px]" />}
            />
          </div>
        </section>
      )}

      {/* Follow strip */}
      {hasSocial && (
        <section className="rounded-2xl border border-border-base bg-paper px-6 py-[22px] shadow-sm">
          <div className="mb-4">
            <p className="font-display text-[17px] font-medium tracking-[-0.01em] text-ink">
              {s.follow_title}
            </p>
            <p className="mt-0.5 font-display text-[12.5px] italic text-text-muted">
              {s.follow_sub}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {location.socialHandles.xhs && (
              <SocialButton
                bg="linear-gradient(135deg, #FF2741, #DD0033)"
                name={s.follow_xhs}
                handle={`@${location.socialHandles.xhs}`}
                onClick={() =>
                  handleFollow(
                    "xhs",
                    `https://www.xiaohongshu.com/user/${location.socialHandles.xhs}`,
                  )
                }
              />
            )}
            {location.socialHandles.ig && (
              <SocialButton
                bg="linear-gradient(135deg, #833AB4, #FD1D1D, #FCB045)"
                name={s.follow_ig}
                handle={`@${location.socialHandles.ig}`}
                onClick={() =>
                  handleFollow(
                    "ig",
                    `https://instagram.com/${location.socialHandles.ig}`,
                  )
                }
              />
            )}
            {location.socialHandles.wechat_mp && (
              <SocialButton
                bg="#07C160"
                name={s.follow_wechat}
                handle={location.socialHandles.wechat_mp}
                onClick={() =>
                  handleFollow("wechat_mp", `weixin://${location.socialHandles.wechat_mp}`)
                }
              />
            )}
            {location.socialHandles.tiktok && (
              <SocialButton
                bg="#000000"
                name={s.follow_tiktok}
                handle={`@${location.socialHandles.tiktok}`}
                onClick={() =>
                  handleFollow(
                    "tiktok",
                    `https://tiktok.com/@${location.socialHandles.tiktok}`,
                  )
                }
              />
            )}
            {location.socialHandles.fb && (
              <SocialButton
                bg="#1877F2"
                name={s.follow_fb}
                handle={location.socialHandles.fb}
                onClick={() =>
                  handleFollow(
                    "fb",
                    `https://facebook.com/${location.socialHandles.fb}`,
                  )
                }
              />
            )}
          </div>
        </section>
      )}

      {/* Done */}
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={handleDone}
          className="inline-block rounded-full border border-border-base bg-transparent px-6 py-3 font-sans text-[13.5px] font-medium text-text-soft transition-colors hover:border-ink hover:bg-paper hover:text-ink"
        >
          {s.done_btn}
        </button>
      </div>

      {/* Footer */}
      <p className="pb-6 text-center text-[11px] text-text-muted">
        Powered by BAAM Review
      </p>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-[13.5px] font-medium text-cream shadow-lg"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold text-ink">
            <Check className="h-2.5 w-2.5 stroke-[3]" />
          </span>
          {toast}
        </div>
      )}

      {/* Animations — inlined since they're page-local */}
      <style>{`
        @keyframes checkmark-pop {
          0% { transform: scale(0.3); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function ActionButton({
  primary,
  accent,
  icon,
  title,
  desc,
  onClick,
}: {
  primary?: boolean;
  accent: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  if (primary) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-center gap-4 rounded-2xl border p-[18px] text-left transition-all hover:translate-x-0.5 hover:shadow-md"
        style={{
          backgroundColor: accent,
          borderColor: accent,
          color: "white",
        }}
      >
        <span className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[10px] bg-white/[0.18] text-white">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-white">
            {title}
          </span>
          <span className="block text-[13px] leading-tight text-white/85">
            {desc}
          </span>
        </span>
        <span className="ml-1 flex-shrink-0 text-white/70">→</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-2xl border border-border-base bg-cream-deep p-[18px] text-left transition-all hover:translate-x-0.5 hover:bg-paper hover:shadow-md"
      style={
        {
          "--hover-border": accent,
        } as React.CSSProperties
      }
    >
      <span
        className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[10px] bg-paper"
        style={{ color: accent }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-ink">{title}</span>
        <span className="block text-[13px] leading-tight text-text-soft">
          {desc}
        </span>
      </span>
      <span className="ml-1 flex-shrink-0 text-text-muted">→</span>
    </button>
  );
}

function SharePreview({
  accent,
  initial,
  displayName,
  address,
  rating,
  quote,
  attribution,
  mark,
  shareImageUrl,
  businessHref,
}: {
  accent: string;
  initial: string;
  displayName: string;
  address: string | null;
  rating: number;
  quote: string;
  attribution: string;
  mark: string;
  shareImageUrl: string | null;
  businessHref: string;
}) {
  return (
    <div
      className="relative mx-[22px] mt-[22px] overflow-hidden rounded-[18px] p-[22px] pt-[26px] text-white shadow-lg"
      style={{
        background: `linear-gradient(160deg, ${accent} 0%, ${accent} 100%)`,
      }}
    >
      <div className="pointer-events-none absolute right-[-20%] top-[-40%] h-[280px] w-[280px] rounded-full bg-white/[0.12] blur-3xl" />

      <span className="relative mb-[18px] inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em]">
        {mark}
      </span>

      <p className="relative mb-3 text-[16px] tracking-[2px]" style={{ color: "#FFD56A" }}>
        {"★".repeat(Math.max(1, Math.min(5, rating)))}
      </p>

      <p className="relative mb-[22px] line-clamp-4 font-display text-[17px] font-normal italic leading-[1.4]">
        {quote}
      </p>

      {attribution.trim().length > 2 && (
        <p className="relative mb-[22px] text-[12px] text-white/75">
          {attribution}
        </p>
      )}

      <div className="relative flex items-center justify-between border-t border-white/[0.18] pt-[18px]">
        <Link
          href={businessHref}
          className="-m-1 flex items-center gap-2.5 rounded-md p-1 transition-opacity hover:opacity-90 focus:opacity-90"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-white font-display text-[18px] font-semibold" style={{ color: accent }}>
            {initial}
          </span>
          <span className="block">
            <span className="block text-[12.5px] font-semibold">
              {displayName}
            </span>
            {address && (
              <span className="block text-[10.5px] text-white/70">
                {address}
              </span>
            )}
          </span>
        </Link>
        {shareImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shareImageUrl}
            alt=""
            className="hidden h-12 w-12 rounded-[8px] bg-white p-1.5"
          />
        )}
      </div>
    </div>
  );
}

function ShareDest({
  variant,
  label,
  accent,
  icon,
  onClick,
}: {
  variant: "fb" | "sms" | "copy" | "more";
  label: string;
  accent?: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  const bg =
    variant === "fb"
      ? "#1877F2"
      : variant === "sms"
        ? accent ?? "#1F4D3F"
        : variant === "copy"
          ? "#0F1F1A"
          : "#5A6660";
  const renderedIcon =
    icon ??
    (variant === "fb" ? (
      <FacebookGlyph className="h-[18px] w-[18px]" />
    ) : variant === "sms" ? (
      <MessageSquare className="h-[18px] w-[18px]" />
    ) : (
      <Share2 className="h-[18px] w-[18px]" />
    ));
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-border-base bg-cream-deep px-2 py-3.5 text-center transition-all hover:-translate-y-0.5 hover:bg-paper hover:shadow-sm"
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white"
        style={{ background: bg }}
      >
        {renderedIcon}
      </span>
      <span className="text-[11.5px] font-medium text-text">{label}</span>
    </button>
  );
}

function SocialButton({
  bg,
  name,
  handle,
  onClick,
}: {
  bg: string;
  name: string;
  handle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border border-border-base bg-cream-deep px-2 py-3.5 text-center transition-all hover:-translate-y-0.5 hover:bg-paper hover:shadow-sm"
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[12px] font-semibold text-white"
        style={{ background: bg }}
      >
        {name.charAt(0)}
      </span>
      <span className="text-[12px] font-medium text-text">{name}</span>
      <span className="text-[10.5px] text-text-muted">{handle}</span>
    </button>
  );
}
