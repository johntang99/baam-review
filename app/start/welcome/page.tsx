import type { Metadata } from "next";
import Link from "next/link";
import { getStripe } from "@/lib/billing/stripe";
import { GBP_MANAGER_EMAIL } from "@/lib/billing/start-now";

export const metadata: Metadata = {
  title: "Welcome to Full Service — BAAM Review",
  description:
    "Your card is saved. Add our manager email to your Google Business Profile to finish setup.",
};

export const dynamic = "force-dynamic";

/**
 * Landing after Stripe Checkout completes for the Start Now flow.
 * Reads ?session_id=cs_… from the URL, fetches the session to pull the
 * business name + trial end date, and shows the customer the single
 * concrete step they need to take: add our manager email to their GBP.
 */
export default async function StartWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;

  // Try to enrich the page with session data — if anything goes wrong
  // (no session id, Stripe down, key not set), fall back to generic copy.
  let firstName: string | null = null;
  let businessName: string | null = null;
  let trialEnd: string | null = null;
  if (sessionId) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });
      const fields = session.custom_fields ?? [];
      // Prefer the explicit "Your name" custom field over the cardholder
      // name — they differ when the card belongs to the business.
      const customerName =
        fields.find((f) => f.key === "customer_name")?.text?.value?.trim() ??
        null;
      const fullName =
        customerName ?? session.customer_details?.name?.trim() ?? null;
      firstName = fullName ? fullName.split(/\s+/)[0] : null;
      businessName =
        fields.find((f) => f.key === "business_name")?.text?.value ?? null;
      const sub = session.subscription;
      const trialEndUnix =
        typeof sub === "object" && sub && "trial_end" in sub ? sub.trial_end : null;
      if (trialEndUnix) {
        trialEnd = new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }).format(new Date(trialEndUnix * 1000));
      }
    } catch (e) {
      // Don't surface this to the user — the page still works without enrichment.
      console.warn("Could not enrich /start/welcome", e);
    }
  }

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

      <div className="mx-auto max-w-[720px] px-6 pb-24 pt-6">
        {/* Confirmation */}
        <div className="rounded-3xl border border-border-base bg-paper p-10 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold/60 bg-gold/15 text-gold-dark">
            <svg
              className="h-7 w-7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="mt-3 text-center text-[11.5px] font-semibold uppercase tracking-[0.18em] text-gold-dark">
            Card saved · subscription started
          </p>
          <h1 className="mt-1 text-center font-display text-[32px] leading-tight text-ink">
            {firstName ? `You're in, ${firstName}.` : "You're in."}{" "}
            <em className="not-italic italic text-forest">Now one quick step.</em>
          </h1>
          <p className="mt-4 text-center font-serif text-[16px] leading-relaxed text-text-soft max-w-md mx-auto">
            We need access to{" "}
            {businessName ? <strong className="text-ink">{businessName}</strong> : "your business"}
            's Google Business Profile so we can post replies and pull your reviews. Add our manager email to your GBP and we'll handle the rest within a week.
          </p>

          {/* The single concrete instruction */}
          <div className="mt-7 rounded-xl border-2 border-gold/40 bg-gold/[0.06] p-5">
            <p className="text-[14px] font-semibold text-ink mb-2">
              Add this email as a <em className="not-italic italic text-forest">Manager</em> on your Google Business Profile:
            </p>
            <div className="font-mono bg-paper px-3 py-2.5 rounded-md border border-gold/50 inline-block text-ink font-semibold text-[15px]">
              {GBP_MANAGER_EMAIL}
            </div>
            <ol className="list-decimal list-inside mt-4 space-y-1.5 text-[13.5px] text-text">
              <li>
                Go to{" "}
                <a
                  href="https://business.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-forest underline"
                >
                  business.google.com
                </a>{" "}
                and pick your business
              </li>
              <li>
                Click <strong>Menu</strong> → <strong>Business Profile settings</strong> → <strong>People and access</strong>
              </li>
              <li>
                Click <strong>Add</strong>, paste <code className="bg-cream-deep px-1.5 py-0.5 rounded text-[12.5px]">{GBP_MANAGER_EMAIL}</code>, choose <strong>Manager</strong> role
              </li>
              <li>Send the invite. We accept within a few hours and start setup.</li>
            </ol>
          </div>

          {/* Two summary cards */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border-base bg-cream-deep/40 p-4">
              <p className="text-[13px] font-semibold text-ink">📅 First week</p>
              <p className="mt-1 text-[12.5px] text-text-soft leading-relaxed">
                We connect your GBP, configure your reward, and send the first
                review-request batch.
              </p>
            </div>
            <div className="rounded-xl border border-border-base bg-cream-deep/40 p-4">
              <p className="text-[13px] font-semibold text-ink">💳 First charge</p>
              <p className="mt-1 text-[12.5px] text-text-soft leading-relaxed">
                {trialEnd ? (
                  <>
                    $399 on <strong className="text-ink">{trialEnd}</strong>. Cancel
                    anytime before then with no charge.
                  </>
                ) : (
                  <>
                    $399 in 30 days. Cancel anytime before then with no charge.
                  </>
                )}
              </p>
            </div>
          </div>

          <p className="mt-7 text-center text-[12.5px] text-text-muted">
            Need help adding the manager?{" "}
            <Link
              href="/start/how-we-work"
              className="text-forest hover:underline"
            >
              See the full setup guide →
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-[12.5px] text-text-muted">
          Questions? Reply to your welcome email, or write to{" "}
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
