import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, Plus, AlertCircle, Settings, Star, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { getInternalContext } from "@/lib/auth/staff";
import {
  AssignManagerModal,
  type AccountManagerOption,
  type AssignedManager,
} from "./assignments/assign-manager-modal";
import {
  getLocationBillingMap,
  type LocationBillingSummary,
} from "@/lib/billing/access";

export const metadata = {
  title: "Locations — BAAM Review",
};

const ERRORS: Record<string, string> = {
  invalid_state: "The connection attempt expired or was tampered with. Please try again.",
  token_exchange: "Google rejected the authorization. Please retry.",
  token_persist: "We received your tokens but couldn't save them. Please retry.",
  no_account: "Your account could not be located. Sign out and back in, then retry.",
  access_denied: "Connection canceled. You can try again anytime.",
};

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/locations");

  // Ops context: null for regular customers (RLS scopes by account_id),
  // present for BAAM internal staff (visibility filtered by ops_role below).
  const internal = await getInternalContext(supabase, user.id);

  let locations:
    | {
        id: string;
        slug: string;
        display_name: string;
        address: string | null;
        business_type: string | null;
        brand_color: string | null;
        logo_url: string | null;
        connected_by_user_id: string | null;
      }[]
    | null = null;

  if (!internal || internal.opsRole === null || internal.opsRole === "admin") {
    // Customer logins, or admin / unset internal users → see everything
    // RLS allows in their account.
    const { data } = await supabase
      .from("locations")
      .select(
        "id, slug, display_name, address, business_type, brand_color, logo_url, connected_by_user_id",
      )
      .order("created_at", { ascending: false });
    locations = data ?? [];
  } else if (internal.opsRole === "sales") {
    // Sales sees only what they personally connected.
    const { data } = await supabase
      .from("locations")
      .select(
        "id, slug, display_name, address, business_type, brand_color, logo_url, connected_by_user_id",
      )
      .eq("connected_by_user_id", internal.userId)
      .order("created_at", { ascending: false });
    locations = data ?? [];
  } else if (internal.opsRole === "account_manager") {
    // Account manager sees only what's been assigned to them.
    const { data: rows } = await supabase
      .from("location_assignments")
      .select(
        "location_id, locations(id, slug, display_name, address, business_type, brand_color, logo_url, connected_by_user_id, created_at)",
      )
      .eq("user_id", internal.userId);
    const flattened = (rows ?? [])
      .map((r) => {
        const rel = r.locations;
        return Array.isArray(rel) ? rel[0] : rel;
      })
      .filter((l): l is NonNullable<typeof l> => !!l)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    locations = flattened.map(
      ({ id, slug, display_name, address, business_type, brand_color, logo_url, connected_by_user_id }) => ({
        id,
        slug,
        display_name,
        address,
        business_type,
        brand_color,
        logo_url,
        connected_by_user_id,
      }),
    );
  } else {
    locations = [];
  }

  // For internal users with assign-rights (admin/sales), load the pool of
  // account_manager users they can pick from, plus current assignments for
  // every visible location in one round-trip.
  let managerOptions: AccountManagerOption[] = [];
  let assignmentsByLocation: Map<string, AssignedManager[]> = new Map();
  const canAssign =
    internal !== null &&
    (internal.opsRole === "admin" || internal.opsRole === "sales");

  if (canAssign && locations.length > 0) {
    const service = createServiceClient();
    const [{ data: managers }, { data: assignmentRows }] = await Promise.all([
      service
        .from("users")
        .select("id, full_name, account_id")
        .eq("ops_role", "account_manager")
        .order("full_name", { ascending: true }),
      service
        .from("location_assignments")
        // Disambiguate: location_assignments has two FKs to users
        // (user_id, assigned_by_user_id). The !user_id hint tells
        // PostgREST to join on the manager FK.
        .select("location_id, user_id, users!user_id(id, full_name, account_id)")
        .in(
          "location_id",
          locations.map((l) => l.id),
        ),
    ]);

    // Resolve emails (lives on accounts.primary_email since the auth user's
    // email isn't on the public.users row).
    const accountIds = Array.from(
      new Set([
        ...((managers ?? []).map((m) => m.account_id)),
        ...((assignmentRows ?? []).flatMap((r) => {
          const rel = r.users;
          const u = Array.isArray(rel) ? rel[0] : rel;
          return u ? [u.account_id] : [];
        })),
      ]),
    );
    const { data: accountEmails } = await service
      .from("accounts")
      .select("id, primary_email")
      .in("id", accountIds);
    const emailByAccount = new Map(
      (accountEmails ?? []).map((a) => [a.id, a.primary_email]),
    );

    managerOptions = (managers ?? []).map((m) => ({
      user_id: m.id,
      full_name: m.full_name,
      email: emailByAccount.get(m.account_id) ?? "",
    }));

    for (const row of assignmentRows ?? []) {
      const rel = row.users;
      const u = Array.isArray(rel) ? rel[0] : rel;
      if (!u) continue;
      const entry: AssignedManager = {
        user_id: u.id,
        full_name: u.full_name,
        email: emailByAccount.get(u.account_id) ?? "",
      };
      const existing = assignmentsByLocation.get(row.location_id) ?? [];
      existing.push(entry);
      assignmentsByLocation.set(row.location_id, existing);
    }
  }

  const billing = await getLocationBillingMap(locations.map((l) => l.id));

  const errorMessage = params.error ? ERRORS[params.error] ?? params.error : null;

  return (
    <main className="px-10 py-10 space-y-8">
      <PageHeader
        eyebrow={internal ? "BAAM Operations" : "Setup"}
        title="Locations"
        description={
          internal?.opsRole === "account_manager"
            ? "Clients assigned to you. Connect requests and reassignment go through your sales lead or admin."
            : internal?.opsRole === "sales"
              ? "Clients you connected. Use the Assign button on a card to bring in an account manager for daily work."
              : "Connect your Google Business Profile to start collecting reviews. Each location gets its own public review page and QR code."
        }
      >
        {internal?.opsRole !== "account_manager" && (
          <Link href="/api/auth/google/start">
            <Button>
              <Plus className="h-4 w-4" />
              Connect Google
            </Button>
          </Link>
        )}
      </PageHeader>

      {errorMessage && (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-alert/30 bg-alert/5 p-4 text-[13.5px] text-alert"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {locations.length === 0 ? (
        <EmptyState role={internal?.opsRole ?? null} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 max-w-4xl">
          {locations.map((loc) => {
            // A sales can only assign on the locations they connected. Admin
            // can assign on anything.
            const showAssignButton =
              canAssign &&
              (internal?.opsRole === "admin" ||
                loc.connected_by_user_id === internal?.userId);
            const currentAssignments = assignmentsByLocation.get(loc.id) ?? [];
            return (
              <li
                key={loc.id}
                className="rounded-xl border border-border-base bg-paper p-5 shadow-sm space-y-4"
              >
                <div className="flex items-start gap-3">
                  {loc.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={loc.logo_url}
                      alt=""
                      className="h-9 w-9 flex-shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-cream font-display text-[15px]"
                      style={{ backgroundColor: loc.brand_color ?? "#1F4D3F" }}
                    >
                      {loc.display_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <Link
                      href={`/app/locations/${loc.id}`}
                      className="block font-display text-[17px] text-ink leading-tight truncate hover:underline"
                    >
                      {loc.display_name}
                    </Link>
                    {loc.business_type && (
                      <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
                        {loc.business_type}
                      </p>
                    )}
                    {loc.address && (
                      <p className="text-[13px] text-text-soft truncate">
                        {loc.address}
                      </p>
                    )}
                    <p className="text-[12.5px] text-text-muted pt-1">
                      /r/{loc.slug}
                    </p>
                    {internal && currentAssignments.length > 0 && (
                      <p className="text-[12px] text-text-soft pt-0.5">
                        Managed by{" "}
                        <span className="text-ink">
                          {currentAssignments
                            .map((a) => a.full_name || a.email)
                            .join(", ")}
                        </span>
                      </p>
                    )}
                    <div className="pt-1.5">
                      <BillingBadge summary={billing.get(loc.id)} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border-soft">
                  <CardLink href={`/app/locations/${loc.id}/reviews`} icon={Star}>
                    Reviews
                  </CardLink>
                  <CardLink href={`/app/locations/${loc.id}/qr`} icon={QrCode}>
                    QR poster
                  </CardLink>
                  <CardLink href={`/app/locations/${loc.id}`} icon={Settings}>
                    Settings
                  </CardLink>
                  {showAssignButton && (
                    <AssignManagerModal
                      locationId={loc.id}
                      locationName={loc.display_name}
                      managers={managerOptions}
                      currentAssignments={currentAssignments}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function BillingBadge({
  summary,
}: {
  summary: LocationBillingSummary | undefined;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium";
  if (!summary || !summary.accountPlan) {
    return (
      <span className={`${base} bg-hover text-text-muted`}>
        No plan chosen
      </span>
    );
  }
  const planLabel =
    summary.accountPlan === "self_service" ? "Self-service" : "Full-service";
  if (!summary.locStatus) {
    return (
      <span className={`${base} bg-gold/15 text-ink`}>
        {planLabel} · Billing required
      </span>
    );
  }
  const method = summary.locMethod === "invoice" ? " · check" : "";
  if (summary.canceling) {
    return (
      <span className={`${base} bg-alert/10 text-alert`}>
        {planLabel} · {summary.locStatus} · canceling{method}
      </span>
    );
  }
  if (summary.locStatus === "past_due") {
    return (
      <span className={`${base} bg-gold/15 text-ink`}>
        {planLabel} · past due (retrying){method}
      </span>
    );
  }
  if (summary.allowed) {
    return (
      <span className={`${base} bg-forest/10 text-forest`}>
        {planLabel} · {summary.locStatus}
        {method}
      </span>
    );
  }
  return (
    <span className={`${base} bg-alert/10 text-alert`}>
      {planLabel} · {summary.locStatus}
      {method}
    </span>
  );
}

function CardLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-medium text-text-soft hover:bg-hover hover:text-ink transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </Link>
  );
}

function EmptyState({ role }: { role: string | null }) {
  if (role === "account_manager") {
    return (
      <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-10 text-center max-w-2xl">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-forest/10 text-forest">
          <MapPin className="h-5 w-5" />
        </span>
        <h2 className="mt-4 font-display text-[20px] text-ink">
          No clients assigned yet
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-[14px] text-text-soft leading-relaxed">
          When a sales lead adds you as the manager on one of their clients,
          it&apos;ll show up here. Ping them if you&apos;re expecting one.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-10 text-center max-w-2xl">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-forest/10 text-forest">
        <MapPin className="h-5 w-5" />
      </span>
      <h2 className="mt-4 font-display text-[20px] text-ink">
        No locations yet
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-[14px] text-text-soft leading-relaxed">
        Connect your Google Business Profile and we&apos;ll pull in your business
        name, address, and the deep-link Google uses for reviews.
      </p>
      <Link href="/api/auth/google/start" className="mt-5 inline-block">
        <Button>
          <Plus className="h-4 w-4" />
          Connect Google Business Profile
        </Button>
      </Link>
    </div>
  );
}
