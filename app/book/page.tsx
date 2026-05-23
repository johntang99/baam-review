import type { Metadata } from "next";
import Link from "next/link";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = {
  title: "Book a free consultation — BAAM Review",
  description:
    "Tell us about your business and when works — we'll reach out within 1 business day with two specific time slots.",
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
        <div className="flex items-center gap-4 text-[13px]">
          <Link href="/book/zh" className="text-text-soft hover:text-ink">
            中文
          </Link>
          <Link href="/pricing" className="text-text-soft hover:text-ink">
            ← Pricing
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[840px] px-6 pb-24 pt-6">
        <p className="text-[11.5px] font-medium uppercase tracking-[0.14em] text-gold-dark">
          A free 30-min call
        </p>
        <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight text-ink">
          Tell us about your business.
        </h1>
        <p className="mt-3 font-serif text-[16px] italic leading-relaxed text-text-soft">
          No sales script. A real conversation about reviews, referrals, and
          revenue — and whether BAAM Review fits.
        </p>

        <div className="mt-8 rounded-2xl border border-border-base bg-paper p-6 shadow-sm">
          <BookingForm lang="en" />
        </div>

        <p className="mt-5 text-center text-[12.5px] text-text-muted">
          Prefer email? Reach us at{" "}
          <a
            href="mailto:support@baamplatform.com"
            className="text-forest hover:underline"
          >
            support@baamplatform.com
          </a>
          .
        </p>
      </div>
    </main>
  );
}
