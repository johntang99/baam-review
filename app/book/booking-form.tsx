"use client";

import { useState, useTransition } from "react";
import { submitBookingRequest } from "./actions";

export function BookingForm({ source = "book" }: { source?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-forest/10 text-forest">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="font-display text-[19px] text-ink">Thanks — we&apos;ll reach out.</p>
        <p className="mt-1.5 text-[13.5px] text-text-soft">
          We&apos;ll email you to lock in a time. Usually within one business day.
        </p>
      </div>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await submitBookingRequest(fd);
      if (res.ok) setDone(true);
      else setError(res.error ?? "Something went wrong.");
    });
  }

  const inputCls =
    "w-full rounded-lg border border-border-base bg-cream px-3.5 py-2.5 text-[14px] text-text focus:border-forest focus:bg-paper focus:outline-none";
  const labelCls =
    "block text-[12px] font-medium text-text mb-1.5 tracking-[0.01em]";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="source" value={source} />
      <div>
        <label htmlFor="bk-name" className={labelCls}>
          Name
        </label>
        <input id="bk-name" name="name" required className={inputCls} />
      </div>
      <div>
        <label htmlFor="bk-email" className={labelCls}>
          Email
        </label>
        <input
          id="bk-email"
          name="email"
          type="email"
          required
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="bk-business" className={labelCls}>
          Business{" "}
          <span className="font-normal text-text-muted">
            (clinic, practice, shop…)
          </span>
        </label>
        <input id="bk-business" name="business" className={inputCls} />
      </div>
      <div>
        <label htmlFor="bk-time" className={labelCls}>
          Preferred time window{" "}
          <span className="font-normal text-text-muted">
            (e.g. weekday afternoons EST)
          </span>
        </label>
        <input id="bk-time" name="preferred_time" className={inputCls} />
      </div>
      <div>
        <label htmlFor="bk-notes" className={labelCls}>
          Anything you want us to know?
        </label>
        <textarea
          id="bk-notes"
          name="notes"
          rows={3}
          className={`${inputCls} resize-y`}
        />
      </div>

      {error && (
        <p className="text-[13px] text-alert" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-forest px-5 py-3 text-[14.5px] font-medium text-cream hover:bg-forest-dark disabled:opacity-50"
      >
        {pending ? "Sending…" : "Request the call →"}
      </button>
      <p className="text-center text-[11.5px] text-text-muted">
        No spam. We only use this to schedule and prep for the call.
      </p>
    </form>
  );
}
