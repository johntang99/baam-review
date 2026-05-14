"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Share2,
  Sparkles,
  Send,
  Trash2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { relativeTime } from "@/lib/analytics/aggregate";
import { syncReviews, type SyncResult } from "./actions";
import { postReply, removeReply } from "./post-reply";

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
            <ReviewCard key={r.id} r={r} locationId={locationId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewCard({ r, locationId }: { r: Review; locationId: string }) {
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

      <ReplySection r={r} locationId={locationId} />
    </li>
  );
}

function ReplySection({ r, locationId }: { r: Review; locationId: string }) {
  const canShare = r.rating >= 4 && !!r.comment;
  const shareHref = `/app/locations/${locationId}/reviews/${r.id}/share`;

  // Three states:
  //   "viewing"  — existing reply already posted; show with Edit/Delete
  //   "editing"  — textarea open for first-time draft OR re-edit
  //   "posting"  — server action in flight
  const [mode, setMode] = useState<"viewing" | "editing">(
    r.reply_comment ? "viewing" : "viewing",
  );
  const [text, setText] = useState<string>(r.reply_comment ?? "");
  const [drafting, startDrafting] = useTransition();
  const [posting, startPosting] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function draftWithAI() {
    setError(null);
    startDrafting(async () => {
      try {
        const res = await fetch("/api/reply-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ review_id: r.id }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { reply: string };
        setText(json.reply);
        setMode("editing");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't generate a draft");
      }
    });
  }

  function startEditing() {
    setError(null);
    setText(r.reply_comment ?? "");
    setMode("editing");
  }

  function cancelEdit() {
    setText(r.reply_comment ?? "");
    setMode("viewing");
    setError(null);
  }

  function onPost() {
    setError(null);
    startPosting(async () => {
      const result = await postReply({ reviewId: r.id, comment: text });
      if (!result.ok) {
        setError(result.error ?? "Couldn't post the reply.");
        return;
      }
      setMode("viewing");
    });
  }

  function onDelete() {
    if (
      !confirm(
        "Remove this reply from Google? The reviewer will no longer see your response.",
      )
    )
      return;
    setError(null);
    startDeleting(async () => {
      const result = await removeReply(r.id);
      if (!result.ok) {
        setError(result.error ?? "Couldn't remove the reply.");
        return;
      }
      setText("");
      setMode("viewing");
    });
  }

  const hasExisting = !!r.reply_comment && mode === "viewing";
  const editing = mode === "editing";

  // No reply yet, not editing → invitation row.
  if (!hasExisting && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={draftWithAI}
          disabled={drafting}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {drafting ? "Drafting…" : "Draft a reply with AI"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setText("");
            setMode("editing");
          }}
        >
          Write manually
        </Button>
        {canShare && (
          <Link
            href={shareHref}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
            title="Generate a share card for this review"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share review
          </Link>
        )}
        {error && (
          <p className="text-[12.5px] text-alert" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Existing reply, viewing mode → show it with edit / delete.
  if (hasExisting) {
    return (
      <div className="rounded-lg bg-cream-deep/40 p-3 text-[13px] text-text-soft space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Your reply
            {r.reply_update_time && (
              <span> · {relativeTime(r.reply_update_time)}</span>
            )}
          </p>
          <div className="flex items-center gap-2.5 text-[11.5px]">
            {canShare && (
              <Link
                href={shareHref}
                className="inline-flex items-center gap-1 text-forest hover:underline"
                title="Generate a share card for this review"
              >
                <Share2 className="h-3 w-3" />
                Share
              </Link>
            )}
            <button
              type="button"
              onClick={startEditing}
              className="text-forest hover:underline"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1 text-text-soft hover:text-alert disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              {deleting ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
        <p className="whitespace-pre-wrap text-text">{r.reply_comment}</p>
        {error && (
          <p className="text-[12.5px] text-alert" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Editing mode — textarea + post / cancel + optional AI re-draft.
  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Thank the reviewer, take ownership if needed, keep it short…"
        className="text-[13.5px] leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={onPost}
          disabled={posting || !text.trim()}
        >
          <Send className="h-3.5 w-3.5" />
          {posting ? "Posting…" : "Post to Google"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={draftWithAI}
          disabled={drafting}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {drafting ? "Drafting…" : r.reply_comment ? "Re-draft with AI" : "Draft with AI"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
          Cancel
        </Button>
        <p className="text-[11.5px] text-text-muted ml-auto">
          {text.length} chars · public reply
        </p>
      </div>
      {error && (
        <p className="text-[12.5px] text-alert" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
