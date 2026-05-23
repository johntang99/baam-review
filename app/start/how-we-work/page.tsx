import type { Metadata } from "next";
import Link from "next/link";
import { GBP_MANAGER_EMAIL } from "@/lib/billing/start-now";

export const metadata: Metadata = {
  title: "How we work together — BAAM Review Full Service",
  description:
    "What happens after you sign up for Full Service: the GBP manager invite, the first-week setup, and the monthly rhythm.",
};

/**
 * Public companion to /start/welcome. Customer can return here any time
 * from the welcome card or the welcome email to re-read the setup steps,
 * see what week-one looks like, and find the support address.
 */
export default function HowWeWorkPage() {
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
          className="text-[13px] text-text-soft hover:text-ink"
        >
          ← Pricing
        </Link>
      </header>

      <div className="mx-auto max-w-[760px] px-6 pb-24 pt-2">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-forest">
          Full Service · How we work
        </p>
        <h1 className="mt-2 font-display text-[40px] leading-[1.05] text-ink">
          Three steps from card to first review.
        </h1>
        <p className="mt-4 font-serif text-[17px] leading-relaxed text-text-soft max-w-[560px]">
          You don&apos;t learn an admin UI. You don&apos;t write replies. You add
          one email to your Google Business Profile and we take it from there.
        </p>

        {/* Step 1 */}
        <Step
          n={1}
          title="Add our manager email to your Google Business Profile"
          eta="2 minutes · you do this"
        >
          <p>
            Open{" "}
            <a
              href="https://business.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-forest underline"
            >
              business.google.com
            </a>{" "}
            and pick your business. Then:
          </p>
          <p className="font-mono bg-paper px-3 py-2 rounded-md border border-gold/50 inline-block text-ink font-semibold text-[14px] mt-1">
            {GBP_MANAGER_EMAIL}
          </p>
          <ol className="list-decimal list-inside mt-3 space-y-1 text-[14px]">
            <li>
              Menu → <strong>Business Profile settings</strong> →{" "}
              <strong>People and access</strong>
            </li>
            <li>
              Click <strong>Add</strong>, paste the email above
            </li>
            <li>
              Choose role: <strong>Manager</strong> (not Owner)
            </li>
            <li>Send the invite</li>
          </ol>
          <p className="text-[13px] text-text-muted mt-3">
            Manager access lets us reply to reviews and pull data. It does not
            let us change your address, transfer ownership, or remove anyone —
            you stay in control.
          </p>
        </Step>

        {/* Step 2 */}
        <Step
          n={2}
          title="We accept the invite and connect your account"
          eta="Within 1 business day · we do this"
        >
          <p>
            We get a notification the moment you send the invite. Our team
            accepts it, connects your Google Business Profile into BAAM Review,
            and sets up:
          </p>
          <ul className="list-disc list-inside mt-3 space-y-1.5 text-[14px]">
            <li>Your trilingual review page (English · 中文 · Español)</li>
            <li>
              Auto-replies that match your business&apos;s voice in all three
              languages
            </li>
            <li>The reward your team will offer reviewers</li>
          </ul>
          <p className="text-[13px] text-text-muted mt-3">
            You&apos;ll get an email confirming each piece is wired up.
            Nothing for you to approve in an admin UI — we&apos;ll just ask a
            couple of questions over email if anything needs your call.
          </p>
        </Step>

        {/* Step 3 */}
        <Step
          n={3}
          title="First review-request batch goes out"
          eta="Within 7 days · we do this"
        >
          <p>
            We send the first batch of review requests to your recent
            customers using the contact list you provide. Reviews start
            arriving within a few days. We reply to every one — positive
            within 24 h, negative within an hour.
          </p>
          <p className="text-[13px] text-text-muted mt-3">
            You&apos;ll get a weekly digest email with: new reviews, ratings
            trend, and what we replied. No dashboard to log into — but a
            customer dashboard is on the roadmap if you want one.
          </p>
        </Step>

        {/* Billing */}
        <section className="mt-10 rounded-2xl border border-border-base bg-paper p-7">
          <h2 className="font-display text-[22px] text-ink">
            Billing — simple and reversible
          </h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13.5px]">
            <div>
              <p className="font-semibold text-ink">Today</p>
              <p className="text-text-soft mt-0.5">
                $0. Card saved, 30-day trial running.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink">Day 30</p>
              <p className="text-text-soft mt-0.5">
                $399 first charge. Then $399 / month.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink">Anytime</p>
              <p className="text-text-soft mt-0.5">
                Email us to cancel. No phone tree, no retention pitch.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-10 space-y-5">
          <h2 className="font-display text-[22px] text-ink">
            Common questions
          </h2>
          <FAQ q="What if I can't find Business Profile settings?">
            Some accounts open straight into the merchant view. Click your
            business name at the top, then the three-dot menu or the gear
            icon. Still stuck? Reply to the welcome email — we&apos;ll send
            screenshots.
          </FAQ>
          <FAQ q="Can I cancel before the first charge?">
            Yes. Any time in the first 30 days, reply to the welcome email or
            write to{" "}
            <a
              href="mailto:support@baamplatform.com"
              className="text-forest hover:underline"
            >
              support@baamplatform.com
            </a>
            . No charge, no questions.
          </FAQ>
          <FAQ q="What if my reviews are mostly negative?">
            That&apos;s when this service is most valuable. We reply fast,
            move conversations off-platform, and surface the patterns to you
            so you can fix the underlying issue. We don&apos;t make problems
            disappear — we make sure the next 50 reviewers see the real
            story.
          </FAQ>
          <FAQ q="Will I lose access to my Google Business Profile?">
            No. You stay Owner. We&apos;re a Manager — we can post and reply,
            but we can&apos;t change ownership, remove you, or transfer the
            listing. Revoke our access in two clicks from People and access.
          </FAQ>
          <FAQ q="Do you support businesses in 中文 or Español?">
            Yes — our review page is trilingual by default, and our team
            replies in the customer&apos;s language. Owners who serve
            Mandarin- or Spanish-speaking customers are the reason this
            product exists.
          </FAQ>
        </section>

        {/* Contact */}
        <section className="mt-12 rounded-2xl border border-gold/40 bg-gold/[0.06] p-7 text-center">
          <p className="font-display text-[19px] text-ink">
            One inbox for everything.
          </p>
          <p className="mt-2 text-[14px] text-text-soft max-w-md mx-auto">
            Reply to your welcome email or write to{" "}
            <a
              href="mailto:support@baamplatform.com"
              className="text-forest hover:underline font-semibold"
            >
              support@baamplatform.com
            </a>
            . A real person — usually within a few hours.
          </p>
        </section>

        <p className="mt-10 text-center text-[12.5px] text-text-muted">
          Not signed up yet?{" "}
          <Link href="/pricing#plans" className="text-forest hover:underline">
            See Full Service pricing →
          </Link>
        </p>
      </div>
    </main>
  );
}

function Step({
  n,
  title,
  eta,
  children,
}: {
  n: number;
  title: string;
  eta: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 flex gap-5">
      <div className="flex-shrink-0">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-paper font-display text-[20px]">
          {n}
        </div>
      </div>
      <div className="flex-1 pt-1">
        <h2 className="font-display text-[22px] text-ink leading-tight">
          {title}
        </h2>
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-text-muted mt-1">
          {eta}
        </p>
        <div className="mt-3 text-[14.5px] leading-relaxed text-text space-y-2">
          {children}
        </div>
      </div>
    </section>
  );
}

function FAQ({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-border-base bg-paper p-5 group">
      <summary className="cursor-pointer font-display text-[16.5px] text-ink list-none flex items-center justify-between">
        {q}
        <span className="text-text-muted text-[18px] group-open:rotate-45 transition-transform">
          +
        </span>
      </summary>
      <div className="mt-3 text-[14px] text-text-soft leading-relaxed">
        {children}
      </div>
    </details>
  );
}
