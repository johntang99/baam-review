import Link from "next/link";

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/#loop", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/#roi", label: "ROI calculator" },
      { href: "/#languages", label: "Languages" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "https://baamplatform.com", label: "BAAM Studio" },
      { href: "/#agencies", label: "For agencies" },
      { href: "mailto:hello@baamplatform.com", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/dpa", label: "DPA" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border-base bg-cream">
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-12 px-8 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-forest text-[14px] font-semibold text-cream">
              B
            </span>
            <span className="font-display text-[20px] font-medium tracking-[-0.02em] text-ink">
              BAAM Review
            </span>
          </div>
          <p className="max-w-[280px] font-serif text-[15px] italic leading-relaxed text-text-soft">
            A Review-to-Revenue Engine for local businesses. From BAAM Studio.
          </p>
        </div>

        {COLS.map((col) => (
          <div key={col.title}>
            <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.14em] text-text-muted">
              {col.title}
            </p>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[14px] text-text-soft transition-colors hover:text-ink"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border-soft">
        <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-3 px-8 py-6 text-[12.5px] text-text-muted sm:flex-row sm:items-center">
          <p>© 2026 BAAM Studio</p>
          <p className="font-serif italic">
            Built in New York · Designed for local businesses everywhere
          </p>
        </div>
      </div>
    </footer>
  );
}
