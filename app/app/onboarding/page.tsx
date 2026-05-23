import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Onboarding queue — BAAM Review" };
export const dynamic = "force-dynamic";

/**
 * Staff Onboarding queue.
 *
 * Lists Start Now customers whose Stripe subscription is active but whose
 * Google Business Profile has not yet been connected. Each row links to
 * the existing GBP picker with a `customer_record` query param so the
 * resulting location is bound back to the customer_record (carrying the
 * Stripe subscription with it).
 *
 * This page reads from customer_records — a table with no per-tenant RLS
 * boundary, so any authenticated user can see it. In practice only BAAM
 * staff have admin logins; this is operational tooling.
 */
export default async function OnboardingQueuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/onboarding");

  // Pending (most urgent first by signup date)
  const { data: pending } = await supabase
    .from("customer_records")
    .select(
      "id, email, business_name, business_address, stripe_subscription_id, created_at",
    )
    .eq("onboarding_status", "pending_gbp_connect")
    .order("created_at", { ascending: true });

  // Recently connected (last 30 days)
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: connected } = await supabase
    .from("customer_records")
    .select(
      "id, business_name, location_id, updated_at, locations(id, display_name, slug)",
    )
    .eq("onboarding_status", "gbp_connected")
    .gte("updated_at", thirtyDaysAgo)
    .order("updated_at", { ascending: false })
    .limit(20);

  const stats = computeStats(pending ?? []);

  return (
    <main className="px-10 py-10 space-y-6">
      <PageHeader
        eyebrow="BAAM Operations"
        title="Onboarding queue"
        description="Customers who paid via Start Now and are waiting for GBP connection. Click 'Connect their GBP' to pick the right business from your authorized Google Business Profile list."
      />

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 max-w-3xl">
        <StatBox
          value={stats.total}
          label="Awaiting GBP"
          tone="text-ink"
        />
        <StatBox
          value={stats.warn}
          label="Day > 5"
          tone="text-warn"
        />
        <StatBox
          value={stats.urgent}
          label="Day > 7 (urgent)"
          tone="text-alert"
        />
        <StatBox
          value={connected?.length ?? 0}
          label="Connected (last 30 d)"
          tone="text-success"
        />
      </div>

      {/* Pending queue */}
      {pending && pending.length > 0 ? (
        <section className="space-y-2.5">
          <h2 className="font-display text-[19px] text-ink">
            Pending GBP connection
          </h2>
          <ul className="rounded-2xl border border-border-base bg-paper divide-y divide-border-base overflow-hidden max-w-4xl">
            {pending.map((row) => (
              <PendingRow key={row.id} row={row} />
            ))}
          </ul>
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-10 text-center max-w-3xl">
          <p className="text-[15px] text-text-soft">
            No Start Now signups waiting. The queue updates automatically when
            new Full Service customers sign up.
          </p>
        </div>
      )}

      {/* Recently connected */}
      {connected && connected.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="font-display text-[19px] text-ink">
            Recently connected
          </h2>
          <ul className="rounded-2xl border border-border-base bg-cream-deep/30 divide-y divide-border-base overflow-hidden max-w-4xl">
            {connected.map((row) => {
              const loc = Array.isArray(row.locations)
                ? row.locations[0]
                : row.locations;
              return (
                <li
                  key={row.id}
                  className="flex items-center gap-4 px-5 py-3 text-[13.5px]"
                >
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-success/15 text-success">
                    ✓
                  </span>
                  <p className="flex-1 text-text">
                    <strong className="text-ink">
                      {row.business_name ?? "(no business name)"}
                    </strong>{" "}
                    <span className="text-text-muted">
                      · connected {relativeTime(row.updated_at)}
                    </span>
                  </p>
                  {loc?.slug && (
                    <Link
                      href={`/app/locations/${loc.id}`}
                      className="text-[12px] text-forest hover:underline"
                    >
                      View location →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

function PendingRow({
  row,
}: {
  row: {
    id: string;
    email: string;
    business_name: string | null;
    business_address: string | null;
    stripe_subscription_id: string;
    created_at: string;
  };
}) {
  const daysOld = Math.floor(
    (Date.now() - new Date(row.created_at).getTime()) / (24 * 60 * 60 * 1000),
  );
  const tone =
    daysOld > 7
      ? "border-l-alert bg-alert/[0.04]"
      : daysOld > 5
        ? "border-l-warn bg-warn/[0.04]"
        : "border-l-success";

  const initial = (row.business_name ?? row.email)
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <li className={`flex items-center gap-5 px-5 py-4 border-l-4 ${tone}`}>
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-cream-deep font-display text-[18px] font-semibold text-ink">
        {initial}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-display text-[17px] text-ink leading-tight">
          {row.business_name ?? "(no business name)"}
        </p>
        <p className="text-[12px] text-text-soft truncate">
          {row.business_address ?? "(no address)"} · {row.email}
        </p>
        <div className="flex items-center gap-3 mt-1 text-[11px]">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success font-semibold">
            ✓ Paid
          </span>
          <span className="text-text-muted">
            Signed up{" "}
            <strong className={daysOld > 5 ? "text-warn" : "text-ink"}>
              {daysOld === 0 ? "today" : `${daysOld}d ago`}
            </strong>
          </span>
          <code className="text-text-muted">{row.stripe_subscription_id}</code>
        </div>
      </div>
      <Link
        href={`/app/locations/connect/picker?customer_record=${row.id}`}
        className="rounded-md bg-forest text-paper text-[13px] font-semibold px-4 py-2 hover:bg-forest-dark"
      >
        Connect their GBP →
      </Link>
    </li>
  );
}

function StatBox({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border-base bg-paper p-4 text-center">
      <p className={`font-display text-[32px] leading-none ${tone}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mt-1.5">
        {label}
      </p>
    </div>
  );
}

function computeStats(rows: { created_at: string }[]) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  let warn = 0;
  let urgent = 0;
  for (const r of rows) {
    const days = (now - new Date(r.created_at).getTime()) / day;
    if (days > 7) urgent++;
    else if (days > 5) warn++;
  }
  return { total: rows.length, warn, urgent };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diff / day);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
