import Link from "next/link";

/**
 * Shown on the dashboard when the active location has no active/trialing
 * billing. Sending requests, the public review page and the widget are
 * blocked until billing is set up.
 */
export function BillingRequiredBanner({
  locationName,
}: {
  locationName: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/50 bg-gold/10 px-4 py-3.5">
      <p className="text-[13.5px] text-ink">
        <span className="font-medium">Billing required</span> — set up billing
        for <span className="font-medium">{locationName}</span> to start
        collecting reviews. Sending requests, the public review page and the
        widget are paused until then.
      </p>
      <Link
        href="/app/billing"
        className="shrink-0 rounded-lg bg-forest px-4 py-2 text-[13px] font-medium text-white hover:bg-forest-dark"
      >
        Set up billing →
      </Link>
    </div>
  );
}
