"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { STRINGS, type Language } from "@/lib/i18n/review";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/review/star-rating";
import { submitPrivateFeedback } from "./actions";

interface FeedbackFormProps {
  slug: string;
  lang: Language;
  token: string | null;
  backHref: string;
}

export function FeedbackForm({ slug, lang, token, backHref }: FeedbackFormProps) {
  const s = STRINGS[lang];
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (rating > 0) fd.set("rating", String(rating));

    startTransition(async () => {
      try {
        await submitPrivateFeedback(fd);
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err) {
          // Next.js redirect throws — let it propagate.
          throw err;
        }
        setError(err instanceof Error ? err.message : s.error_generic);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="lang" value={lang} />
      {token && <input type="hidden" name="token" value={token} />}

      <div className="space-y-2">
        <label className="block text-[12.5px] font-medium tracking-tight text-text-soft">
          {s.private_rating}
        </label>
        <StarRating value={rating} onChange={setRating} />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="message"
          className="block text-[12.5px] font-medium tracking-tight text-text-soft"
        >
          {s.private_message}
        </label>
        <Textarea
          id="message"
          name="message"
          rows={5}
          required
          placeholder={s.private_message_placeholder}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-[12.5px] font-medium tracking-tight text-text-soft"
        >
          {s.private_email}
        </label>
        <Input id="email" name="email" type="email" autoComplete="email" />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="phone"
          className="block text-[12.5px] font-medium tracking-tight text-text-soft"
        >
          {s.private_phone}
        </label>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" />
      </div>

      {error && (
        <p className="text-sm text-alert" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[13px] text-text-soft hover:text-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {s.cta_back}
        </Link>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? s.private_submitting : s.private_submit}
        </Button>
      </div>
    </form>
  );
}
