// Server-safe rendering helpers used by every widget layout. No "use client"
// directive — these are pure functions and work in both server and client
// trees. The "data-action" attributes are picked up by the iframe-level
// WidgetTracker so each click logs a widget_event without any per-component
// JS wiring.

import type { ResolvedWidgetConfig } from "@/lib/widget/config";

export interface WidgetReview {
  id: string;
  google_review_id: string;
  reviewer_display_name: string | null;
  rating: number;
  comment: string | null;
  review_create_time: string;
  reply_comment: string | null;
}

export function Stars({
  rating,
  accent,
  small = false,
}: {
  rating: number;
  accent: string;
  small?: boolean;
}) {
  const filled = Math.round(rating);
  return (
    <span
      className={
        small ? "text-[13px] tracking-[1.5px]" : "text-[15px] tracking-[2px]"
      }
      style={{ color: accent }}
      aria-label={`${rating} out of 5`}
    >
      {"★".repeat(filled)}
      <span className="opacity-25">{"★".repeat(5 - filled)}</span>
    </span>
  );
}

export function ReviewCard({
  review,
  cfg,
  googleUrl,
  lang,
  fullHeight = true,
}: {
  review: WidgetReview;
  cfg: ResolvedWidgetConfig;
  googleUrl: string | null;
  lang?: string;
  /** When false, the card sizes to its content rather than stretching. */
  fullHeight?: boolean;
}) {
  const initials = (review.reviewer_display_name ?? "?")
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
  const comment = pickComment(review.comment, lang);
  return (
    <a
      href={googleUrl ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      data-action="review_click"
      data-review-id={review.google_review_id}
      className={
        (fullHeight ? "h-full " : "") +
        "flex flex-col gap-3 rounded-2xl border border-border-base bg-paper p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <Stars rating={review.rating} accent={cfg.accentColor} />
        <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
          {formatDate(review.review_create_time)}
        </span>
      </div>
      <p className="line-clamp-5 flex-1 text-[14px] leading-relaxed text-text">
        {comment}
      </p>
      <div className="mt-1 flex items-center gap-2.5 border-t border-border-soft pt-3">
        <span
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold text-cream"
          style={{ background: cfg.accentColor }}
        >
          {initials || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-ink">
            {review.reviewer_display_name ?? "Verified customer"}
          </p>
          <p className="text-[10.5px] text-text-muted">via Google</p>
        </div>
      </div>
      {cfg.showReply && review.reply_comment && (
        <div className="rounded-lg bg-cream-deep px-3 py-2">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
            Owner response
          </p>
          <p className="line-clamp-3 text-[12px] leading-snug text-text-soft">
            {review.reply_comment}
          </p>
        </div>
      )}
    </a>
  );
}

export function CompactRow({
  review,
  cfg,
  googleUrl,
  lang,
}: {
  review: WidgetReview;
  cfg: ResolvedWidgetConfig;
  googleUrl: string | null;
  lang?: string;
}) {
  const comment = pickComment(review.comment, lang);
  return (
    <a
      href={googleUrl ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      data-action="review_click"
      data-review-id={review.google_review_id}
      className="block rounded-xl border border-border-base bg-paper px-4 py-3 shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[13.5px] font-medium text-ink">
          {review.reviewer_display_name ?? "Verified customer"}
        </p>
        <Stars rating={review.rating} accent={cfg.accentColor} small />
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-text-soft">
        {comment}
      </p>
    </a>
  );
}

/**
 * Google's GBP API returns translated reviews in the format:
 *   (Translated by Google) <english>\n\n(Original)\n<source>
 * Parse it so we can show the original instead of the translation when the
 * viewer's locale matches the source language.
 */
export function parseGoogleComment(
  raw: string | null | undefined,
): { translated: string | null; original: string | null } {
  if (!raw) return { translated: null, original: null };
  const TRANS = "(Translated by Google)";
  const ORIG = "(Original)";
  if (!raw.includes(TRANS)) return { translated: raw, original: null };
  const afterTrans = raw.slice(raw.indexOf(TRANS) + TRANS.length).trim();
  const origAt = afterTrans.indexOf(ORIG);
  if (origAt < 0) return { translated: afterTrans, original: null };
  return {
    translated: afterTrans.slice(0, origAt).trim(),
    original: afterTrans.slice(origAt + ORIG.length).trim(),
  };
}

/**
 * Pick the comment variant to show given the current locale. zh viewers get
 * the original when it exists (overwhelmingly Chinese in this product's
 * dataset); en / es viewers get Google's translation when one exists.
 */
export function pickComment(
  raw: string | null | undefined,
  lang: string | undefined,
): string | null {
  if (!raw) return null;
  const { translated, original } = parseGoogleComment(raw);
  if (!translated && !original) return raw;
  if (lang === "zh") return original ?? translated ?? raw;
  return translated ?? original ?? raw;
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const days = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days < 1) return "Today";
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
  } catch {
    return "";
  }
}
