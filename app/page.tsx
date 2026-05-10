import Link from "next/link";

export default function MarketingHome() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6">
      <div className="max-w-xl text-center space-y-6">
        <div className="inline-flex items-center gap-2.5 rounded-full bg-paper border border-border-base px-3 py-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-gold text-ink text-[11px] font-semibold">
            B
          </span>
          <span className="text-xs uppercase tracking-[0.14em] text-text-soft">
            BAAM Review
          </span>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl text-ink leading-[1.05] tracking-tight">
          Coming soon.
        </h1>

        <p className="text-base text-text-soft leading-relaxed">
          The easiest way for a local business to turn happy customers into
          Google reviews. Setup in five minutes. Customer flow in sixty seconds.
        </p>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-forest text-cream px-5 text-sm font-medium hover:bg-forest-dark transition-colors"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border-base bg-paper px-5 text-sm font-medium text-text hover:bg-hover transition-colors"
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
