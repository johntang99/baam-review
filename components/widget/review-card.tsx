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
  fullHeight = true,
}: {
  review: WidgetReview;
  cfg: ResolvedWidgetConfig;
  googleUrl: string | null;
  /** When false, the card sizes to its content rather than stretching. */
  fullHeight?: boolean;
}) {
  const initials = (review.reviewer_display_name ?? "?")
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
  return (
    <a
      href={googleUrl ?? "#"}
      target="_top"
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
        {review.comment}
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
}: {
  review: WidgetReview;
  cfg: ResolvedWidgetConfig;
  googleUrl: string | null;
}) {
  return (
    <a
      href={googleUrl ?? "#"}
      target="_top"
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
        {review.comment}
      </p>
    </a>
  );
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
