import type { Metadata } from "next";
import Link from "next/link";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = {
  title: "Book a 15-min intro call — BAAM Review",
  description:
    "Tell us a bit about your business and when works — we'll reach out to schedule a short intro call.",
};

export default function BookPage() {
  return (
    <main className="min-h-screen bg-cream text-text">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="font-display text-[20px] font-medium tracking-tight text-ink"
        >
          BAAM Review
        </Link>
        <Link
          href="/pricing"
          className="text-[13.5px] text-text-soft hover:text-ink"
        >
          ← Pricing
        </Link>
      </header>

      <div className="mx-auto max-w-[560px] px-6 pb-24 pt-6">
        <p className="text-[11.5px] font-medium uppercase tracking-[0.14em] text-gold-dark">
          15-minute intro call
        </p>
        <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight text-ink">
          Let&apos;s talk about your reviews.
        </h1>
        <p className="mt-3 font-serif text-[16px] italic leading-relaxed text-text-soft">
          A short, no-pitch call to see if BAAM Review fits your business.
          Tell us a little and when works — we&apos;ll reach out to schedule.
        </p>

        <div className="mt-8 rounded-2xl border border-border-base bg-paper p-6 shadow-sm">
          <BookingForm />
        </div>

        <p className="mt-5 text-center text-[12.5px] text-text-muted">
          Prefer email? Reach us anytime — we read everything.
        </p>
      </div>
    </main>
  );
}
