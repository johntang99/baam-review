import Link from "next/link";
import {
  BookOpen,
  Mail,
  Send,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";

export const metadata = {
  title: "Setup guides — BAAM Review",
};

interface GuideCard {
  href: string;
  title: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface Category {
  label: string;
  description: string;
  guides: GuideCard[];
}

/**
 * Help hub — central index of all SOPs, setup guides, and operational
 * docs. Each card links to a /app/docs/<slug> route that renders the
 * underlying markdown from /docs/operations/.
 *
 * When adding a new guide:
 *   1. Write the markdown in /docs/operations/MY_NEW_GUIDE.md
 *   2. Create app/app/docs/my-new-guide/page.tsx using DocRenderer
 *   3. Add a card to the appropriate category below
 *
 * Guides marked "Coming soon" intentionally have no href — they're
 * placeholders for upcoming docs, kept visible here so staff knows
 * what's planned.
 */
const CATEGORIES: Category[] = [
  {
    label: "Setup & onboarding",
    description: "Configure a new location or new client.",
    guides: [
      {
        href: "/app/docs/custom-sender-setup",
        title: "Custom sender domain",
        blurb:
          "DNS, SPF, DKIM, MX. The biggest lever for inbox placement. Required for Full Service customers.",
        icon: Mail,
        badge: "Required",
      },
      {
        title: "Connecting Google Business Profile",
        blurb:
          "OAuth flow, multi-location picker, common verification errors.",
        icon: BookOpen,
        href: "",
        badge: "Coming soon",
      },
      {
        title: "Billing setup per location",
        blurb:
          "Stripe Checkout for self-service vs. invoice-by-check for Full Service.",
        icon: BookOpen,
        href: "",
        badge: "Coming soon",
      },
    ],
  },
  {
    label: "Day-to-day operations",
    description: "Sending review requests, replying to reviews, ongoing work.",
    guides: [
      {
        href: "/app/docs/single-review-request",
        title: "Single review request",
        blurb:
          "Composing one-off sends with AI rewrite, tone selection, deliverability best practices.",
        icon: Send,
      },
      {
        href: "/app/docs/bulk-review-request",
        title: "Bulk review requests",
        blurb:
          "Customer lists, AI variants, balanced assignment, volume warm-up, mixed-language handling.",
        icon: ClipboardCheck,
      },
      {
        title: "Reviews reply & share",
        blurb: "AI-drafted replies in EN/中文/Español; sharing best reviews.",
        icon: BookOpen,
        href: "",
        badge: "Coming soon",
      },
      {
        title: "Reward & referral configuration",
        blurb: "Per-location reward setup, referral tracking, payout rules.",
        icon: BookOpen,
        href: "",
        badge: "Coming soon",
      },
    ],
  },
  {
    label: "Reference",
    description: "Conceptual material — read once, refer back as needed.",
    guides: [
      {
        title: "Staff roles & permissions",
        blurb:
          "Admin / sales / account manager / customer — what each role can do.",
        icon: BookOpen,
        href: "",
        badge: "Coming soon",
      },
      {
        title: "Lifecycle funnel",
        blurb:
          "Sent → Delivered → Opened → Clicked → Reviewed. What each stage means and how it's tracked.",
        icon: BookOpen,
        href: "",
        badge: "Coming soon",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <main className="px-10 py-8 pb-16 max-w-[960px]">
      <div className="mb-8">
        <p className="text-[11.5px] uppercase tracking-[0.14em] text-text-muted font-medium mb-2">
          Help
        </p>
        <h1 className="font-display text-[40px] leading-[1.05] tracking-tight text-ink mb-2.5">
          Setup <em className="italic text-forest">guides.</em>
        </h1>
        <p className="font-serif italic text-[17px] text-text-soft max-w-[600px] leading-relaxed">
          Standard operating procedures and setup walkthroughs. Open one,
          read it end-to-end the first time, then keep the tab open as a
          reference while you work.
        </p>
      </div>

      <div className="space-y-10">
        {CATEGORIES.map((cat) => (
          <section key={cat.label}>
            <div className="mb-4">
              <h2 className="font-display text-[18px] text-ink mb-1">
                {cat.label}
              </h2>
              <p className="text-[13px] text-text-soft">{cat.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {cat.guides.map((g) => {
                const Icon = g.icon;
                const comingSoon = !g.href;
                const inner = (
                  <div
                    className={`flex h-full items-start gap-3 rounded-2xl border bg-paper p-5 transition-colors ${
                      comingSoon
                        ? "border-border-soft opacity-85"
                        : "border-border-base hover:border-forest/40 hover:bg-cream-deep/30"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                        comingSoon
                          ? "bg-cream-deep/50 text-text-muted"
                          : "bg-forest/10 text-forest"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[14.5px] font-medium text-ink">
                          {g.title}
                        </h3>
                        {g.badge && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                              comingSoon
                                ? "bg-cream-deep/60 text-text-muted"
                                : "bg-forest/10 text-forest"
                            }`}
                          >
                            {g.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[12.5px] text-text-soft leading-relaxed">
                        {g.blurb}
                      </p>
                      {!comingSoon && (
                        <div className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-forest">
                          Read guide
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  </div>
                );

                return comingSoon ? (
                  <div key={g.title}>{inner}</div>
                ) : (
                  <Link key={g.title} href={g.href} className="block">
                    {inner}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
