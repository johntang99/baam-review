"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/analytics/aggregate";
import { syncReviews, type SyncResult } from "./actions";

interface Review {
  id: string;
  google_review_id: string;
  reviewer_display_name: string | null;
  reviewer_profile_photo_url: string | null;
  rating: number;
  comment: string | null;
  review_create_time: string;
  reply_comment: string | null;
  reply_update_time: string | null;
  alerted_at: string | null;
}

interface ReviewsListProps {
  locationId: string;
  reviews: Review[];
  reviewsSyncedAt: string | null;
}

export function ReviewsList({
  locationId,
  reviews,
  reviewsSyncedAt,
}: ReviewsListProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);

  function onSync() {
    setResult(null);
    startTransition(async () => {
      const r = await syncReviews(locationId);
      setResult(r);
      router.refresh();
    });
  }

  // Aggregate stats.
  const total = reviews.length;
  const avg =
    total === 0 ? 0 : reviews.reduce((s, r) => s + r.rating, 0) / total;
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
  const responseRate =
    total === 0
      ? 0
      : reviews.filter((r) => r.reply_comment).length / total;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Last synced
          </p>
          <p className="text-[13px] text-text-soft">
            {reviewsSyncedAt
              ? relativeTime(reviewsSyncedAt)
              : "Never — click Sync to pull from Google."}
          </p>
        </div>
        <Button type="button" onClick={onSync} disabled={pending}>
          <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {pending ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      {result && !result.ok && (
        <div
          role="alert"
          className="flex gap-2.5 rounded-xl border border-alert/30 bg-alert/5 p-3 text-[13px] text-alert"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{result.error}</p>
        </div>
      )}

      {result?.ok && (
        <div className="flex gap-2.5 rounded-xl border border-success/30 bg-success/5 p-3 text-[13px] text-text">
          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-success" />
          <p>
            Synced. {result.inserted ?? 0} new ·{" "}
            {result.updated ?? 0} updated
            {result.alerts ? ` · ${result.alerts} alert${result.alerts === 1 ? "" : "s"} sent` : ""}.
          </p>
        </div>
      )}

      <section className="rounded-2xl border border-border-base bg-paper p-5">
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div className="space-y-1 sm:border-r sm:border-border-base sm:pr-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Average
            </p>
            <p className="font-display text-[32px] text-ink leading-none">
              {avg.toFixed(1)}
            </p>
            <p className="text-gold text-[16px] tracking-tight">
              {"★".repeat(Math.round(avg))}
              {"☆".repeat(5 - Math.round(avg))}
            </p>
            <p className="text-[12px] text-text-soft">
              {total} review{total === 1 ? "" : "s"} ·{" "}
              {Math.round(responseRate * 100)}% replied
            </p>
          </div>

          <ul className="space-y-1.5 self-center">
            {dist.map((d) => (
              <li key={d.star} className="flex items-center gap-3 text-[12.5px]">
                <span className="w-8 text-text-soft tabular-nums">
                  {d.star}★
                </span>
                <div className="flex-1 h-2 rounded-full bg-cream-deep/60 overflow-hidden">
                  <div
                    className="h-full bg-gold"
                    style={{ width: total === 0 ? "0%" : `${(d.count / total) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right text-text-muted tabular-nums">
                  {d.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-8 text-center text-[13.5px] text-text-soft">
          {reviewsSyncedAt
            ? "No Google reviews yet for this location."
            : "Click Sync now to pull reviews from Google Business Profile."}
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <ReviewCard key={r.id} r={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewCard({ r }: { r: Review }) {
  const low = r.rating <= 2;
  return (
    <li
      className={`rounded-2xl border bg-paper p-5 ${
        low ? "border-alert/30" : "border-border-base"
      }`}
    >
      <div className="flex items-start gap-3 mb-2">
        {r.reviewer_profile_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.reviewer_profile_photo_url}
            alt=""
            className="h-9 w-9 rounded-full flex-shrink-0 object-cover"
          />
        ) : (
          <span className="h-9 w-9 rounded-full bg-sage-soft flex-shrink-0 flex items-center justify-center text-forest-dark font-medium text-[14px]">
            {(r.reviewer_display_name ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13.5px] text-ink truncate font-medium">
              {r.reviewer_display_name ?? "Anonymous"}
            </p>
            <span className="text-[11.5px] text-text-muted whitespace-nowrap">
              {relativeTime(r.review_create_time)}
            </span>
          </div>
          <p className="text-gold text-[14px]">
            {"★".repeat(r.rating)}
            {"☆".repeat(5 - r.rating)}
          </p>
        </div>
      </div>

      {r.comment && (
        <p className="text-[14px] text-text leading-relaxed whitespace-pre-wrap mb-3">
          {r.comment}
        </p>
      )}

      {r.reply_comment ? (
        <div className="rounded-lg bg-cream-deep/40 p-3 text-[13px] text-text-soft space-y-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Your reply{" "}
            {r.reply_update_time && (
              <span className="text-text-muted">
                · {relativeTime(r.reply_update_time)}
              </span>
            )}
          </p>
          <p className="whitespace-pre-wrap">{r.reply_comment}</p>
        </div>
      ) : (
        <p className="text-[12.5px] text-text-muted italic">
          No reply yet. (AI-drafted replies coming in Session R2.)
        </p>
      )}
    </li>
  );
}
