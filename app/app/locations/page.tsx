import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, AlertCircle, MapPin, Settings, Star, QrCode } from "lucide-react";
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
import {
  LocationsToolbar,
  type SortOption,
  type ViewMode,
  type PlanFilter,
  type BillingFilter,
  type PersonOption,
} from "./locations-toolbar";
import { LocationsTable, type LocationRow } from "./locations-table";

export const metadata = {
  title: "Locations — BAAM Review",
};

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid_state: "The connection attempt expired or was tampered with. Please try again.",
  token_exchange: "Google rejected the authorization. Please retry.",
  token_persist: "We received your tokens but couldn't save them. Please retry.",
  no_account: "Your account could not be located. Sign out and back in, then retry.",
  access_denied: "Connection canceled. You can try again anytime.",
};

const PER_PAGE = 50;

const VALID_SORTS = new Set<SortOption>([
  "attention",
  "recent",
  "name_asc",
  "name_desc",
  "last_review",
  "oldest_contract",
]);

interface RawSearchParams {
  error?: string;
  view?: string;
  sort?: string;
  plan?: string;
  billing?: string;
  managed_by?: string;
  connected_by?: string;
  q?: string;
  page?: string;
}

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/locations");

  // ── Parse URL state ────────────────────────────────────────────────────
  const view: ViewMode = params.view === "grid" ? "grid" : "list";
  const sort: SortOption =
    params.sort && VALID_SORTS.has(params.sort as SortOption)
      ? (params.sort as SortOption)
      : "attention";
  const plan = (params.plan ?? "") as PlanFilter;
  const billing = (params.billing ?? "") as BillingFilter;
  const managedBy = params.managed_by ?? "";
  const connectedBy = params.connected_by ?? "";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);

  // Reconstruct the param string so child components can build links
  // (preserving the user's other filters when they change one thing).
  const paramObj: Record<string, string> = {};
  if (view !== "list") paramObj.view = view;
  if (sort !== "attention") paramObj.sort = sort;
  if (plan) paramObj.plan = plan;
  if (billing) paramObj.billing = billing;
  if (managedBy) paramObj.managed_by = managedBy;
  if (connectedBy) paramObj.connected_by = connectedBy;
  if (q) paramObj.q = q;
  if (page > 1) paramObj.page = String(page);
  const searchParamsString = new URLSearchParams(paramObj).toString();

  // ── Visibility filter ─────────────────────────────────────────────────
  const internal = await getInternalContext(supabase, user.id);

  // Self-service customers who connected a location but never picked a
  // plan end up here with all billing columns showing "—" and no path
  // forward. Detect this state so we can render a "Pick a plan" banner
  // above the table. (Skip for BAAM internal users — they don't have a
  // customer-style plan flow.)
  let needsPlanSelection = false;
  if (!internal) {
    const { data: profile } = await supabase
      .from("users")
      .select("account_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.account_id) {
      const { data: acct } = await supabase
        .from("accounts")
        .select("review_plan, is_baam_internal")
        .eq("id", profile.account_id)
        .maybeSingle();
      needsPlanSelection =
        !acct?.is_baam_internal && acct?.review_plan === null;
    }
  }

  // Build the *base* set of visible location ids (before filters).
  let baseVisibleIds: string[] | null;
  if (!internal || internal.opsRole === null || internal.opsRole === "admin") {
    baseVisibleIds = null; // no extra filter; RLS handles tenant scoping
  } else if (internal.opsRole === "sales") {
    const { data } = await supabase
      .from("locations")
      .select("id")
      .eq("connected_by_user_id", internal.userId);
    baseVisibleIds = (data ?? []).map((r) => r.id);
  } else if (internal.opsRole === "account_manager") {
    const { data } = await supabase
      .from("location_assignments")
      .select("location_id")
      .eq("user_id", internal.userId);
    baseVisibleIds = (data ?? []).map((r) => r.location_id);
  } else {
    baseVisibleIds = [];
  }

  // ── Fetch every visible location's full data (we sort/filter in JS so
  //    we can express "Needs attention first" cleanly). Bounded set per
  //    user, so JS-side handling is fine.
  //
  //    Internal admins use the SERVICE client so the query crosses tenant
  //    boundaries — without this, RLS scopes to BAAM Ops only and the
  //    self-service customers' locations stay hidden. Sales / account
  //    managers also go through the service client since their
  //    baseVisibleIds is already constrained by ownership/assignment.
  //    Customers (internal=null) use the regular client so RLS keeps
  //    them inside their own tenant. ────────────────────────────────────
  const locsClient = internal ? createServiceClient() : supabase;
  let locsQuery = locsClient
    .from("locations")
    .select(
      "id, slug, display_name, address, business_type, brand_color, logo_url, connected_by_user_id, connected_via_google_email, created_at, reviews_synced_at",
    );
  if (baseVisibleIds !== null) {
    if (baseVisibleIds.length === 0) {
      locsQuery = locsQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      locsQuery = locsQuery.in("id", baseVisibleIds);
    }
  }
  const { data: locsRaw } = await locsQuery;
  const allLocations = locsRaw ?? [];

  // ── Billing data per location ─────────────────────────────────────────
  const billingMap = await getLocationBillingMap(allLocations.map((l) => l.id));

  // ── Assignments per location (with user names) ────────────────────────
  const service = createServiceClient();
  const [{ data: assignmentRows }, { data: authList }] = await Promise.all([
    allLocations.length > 0
      ? service
          .from("location_assignments")
          .select("location_id, user_id, users!user_id(id, full_name)")
          .in(
            "location_id",
            allLocations.map((l) => l.id),
          )
      : { data: [] },
    service.auth.admin.listUsers({ perPage: 1000, page: 1 }),
  ]);
  const emailByUserId = new Map(
    (authList?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );

  const assignmentsByLocation = new Map<string, AssignedManager[]>();
  for (const row of assignmentRows ?? []) {
    const rel = row.users;
    const u = Array.isArray(rel) ? rel[0] : rel;
    if (!u) continue;
    const entry: AssignedManager = {
      user_id: u.id,
      full_name: u.full_name,
      email: emailByUserId.get(u.id) ?? "",
    };
    const existing = assignmentsByLocation.get(row.location_id) ?? [];
    existing.push(entry);
    assignmentsByLocation.set(row.location_id, existing);
  }

  // ── Account manager pool for the Assign modal + Managed by filter ────
  const { data: managers } = await service
    .from("users")
    .select("id, full_name")
    .eq("ops_role", "account_manager")
    .order("full_name", { ascending: true });
  const managerOptions: AccountManagerOption[] = (managers ?? []).map((m) => ({
    user_id: m.id,
    full_name: m.full_name,
    email: emailByUserId.get(m.id) ?? "",
  }));

  // ── Connector pool (admin + sales who actually connected a location) ─
  const connectorIds = Array.from(
    new Set(
      allLocations
        .map((l) => l.connected_by_user_id)
        .filter((id): id is string => !!id),
    ),
  );
  const { data: connectorRows } =
    connectorIds.length > 0
      ? await service
          .from("users")
          .select("id, full_name")
          .in("id", connectorIds)
      : { data: [] };
  const connectorById = new Map(
    (connectorRows ?? []).map((u) => [u.id, u.full_name]),
  );
  const connectorOptions: PersonOption[] = (connectorRows ?? []).map((u) => ({
    user_id: u.id,
    full_name: u.full_name,
    email: emailByUserId.get(u.id) ?? "",
  }));

  // ── Decide assign-rights per row ──────────────────────────────────────
  const canAssign =
    internal !== null &&
    (internal.opsRole === "admin" || internal.opsRole === "sales");

  // ── Compose LocationRow for each (with derived billing fields) ────────
  const rows: LocationRow[] = allLocations.map((l) => {
    const billing = billingMap.get(l.id);
    const status = deriveBillingStatus(billing);
    const contractDates = deriveContractDates(billing);
    const showAssign =
      canAssign &&
      (internal?.opsRole === "admin" ||
        l.connected_by_user_id === internal?.userId);
    return {
      id: l.id,
      slug: l.slug,
      display_name: l.display_name,
      address: l.address,
      business_type: l.business_type,
      brand_color: l.brand_color,
      logo_url: l.logo_url,
      connected_by_user_id: l.connected_by_user_id,
      connected_by_name: l.connected_by_user_id
        ? connectorById.get(l.connected_by_user_id) ?? null
        : null,
      connected_via_google_email: l.connected_via_google_email,
      plan: billing?.accountPlan ?? null,
      billing_status: status,
      contract_start: contractDates.start,
      contract_next_or_end: contractDates.nextOrEnd,
      contract_next_amount_cents: contractDates.nextAmountCents,
      assignments: assignmentsByLocation.get(l.id) ?? [],
      canAssign: showAssign,
      _created_at: l.created_at,
      _reviews_synced_at: l.reviews_synced_at,
    } as LocationRow & { _created_at: string; _reviews_synced_at: string | null };
  });

  // ── Filters ──────────────────────────────────────────────────────────
  let filtered = rows;
  if (plan) filtered = filtered.filter((r) => r.plan === plan);
  if (billing)
    filtered = filtered.filter((r) => r.billing_status === billing);
  if (managedBy === "unassigned") {
    filtered = filtered.filter((r) => r.assignments.length === 0);
  } else if (managedBy) {
    filtered = filtered.filter((r) =>
      r.assignments.some((a) => a.user_id === managedBy),
    );
  }
  if (connectedBy)
    filtered = filtered.filter((r) => r.connected_by_user_id === connectedBy);
  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.display_name.toLowerCase().includes(needle) ||
        (r.address ?? "").toLowerCase().includes(needle) ||
        r.slug.toLowerCase().includes(needle),
    );
  }

  // ── Sort ─────────────────────────────────────────────────────────────
  filtered = [...filtered].sort((a, b) => {
    const xa = a as LocationRow & {
      _created_at: string;
      _reviews_synced_at: string | null;
    };
    const xb = b as LocationRow & {
      _created_at: string;
      _reviews_synced_at: string | null;
    };
    if (sort === "name_asc") {
      return a.display_name.localeCompare(b.display_name);
    }
    if (sort === "name_desc") {
      return b.display_name.localeCompare(a.display_name);
    }
    if (sort === "recent") {
      return (
        new Date(xb._created_at).getTime() -
        new Date(xa._created_at).getTime()
      );
    }
    if (sort === "last_review") {
      const ax = xa._reviews_synced_at
        ? new Date(xa._reviews_synced_at).getTime()
        : 0;
      const bx = xb._reviews_synced_at
        ? new Date(xb._reviews_synced_at).getTime()
        : 0;
      return bx - ax;
    }
    if (sort === "oldest_contract") {
      // Oldest contract = earliest contract_start (treat null as +∞).
      const ax = a.contract_start
        ? new Date(a.contract_start).getTime()
        : Infinity;
      const bx = b.contract_start
        ? new Date(b.contract_start).getTime()
        : Infinity;
      return ax - bx;
    }
    // attention: required > past_due > trialing > canceling > active > canceled > null
    const priority = (s: LocationRow["billing_status"]) =>
      s === "required"
        ? 0
        : s === "past_due"
          ? 1
          : s === "trialing"
            ? 2
            : s === "canceling"
              ? 3
              : s === "active"
                ? 4
                : s === "canceled"
                  ? 5
                  : 6;
    const pa = priority(a.billing_status);
    const pb = priority(b.billing_status);
    if (pa !== pb) return pa - pb;
    // Secondary: newest first within the same bucket.
    return (
      new Date(xb._created_at).getTime() - new Date(xa._created_at).getTime()
    );
  });

  // ── Pagination (after filter + sort) ─────────────────────────────────
  const total = filtered.length;
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const rangeStart = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const rangeEnd = Math.min(page * PER_PAGE, total);

  const errorMessage = params.error ? ERRORS[params.error] ?? params.error : null;

  return (
    <main className="px-10 py-10 space-y-4">
      <PageHeader
        eyebrow={internal ? "BAAM Operations" : "Setup"}
        title="Locations"
        description={
          internal?.opsRole === "account_manager"
            ? "Clients assigned to you. Filter, sort, and run daily ops in one place."
            : internal?.opsRole === "sales"
              ? "Clients you connected. Add account managers and track billing here."
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

      {/* Self-service plan-selection prompt. Shown when a customer has
          one or more locations but has not yet picked a plan — the
          billing columns are all "—" in that state and there's no other
          on-screen hint about what to do next. */}
      {needsPlanSelection && total > 0 && (
        <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-gold/40 bg-gold/[0.08] px-5 py-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-gold-dark mt-0.5" />
          <div className="flex-1 min-w-[280px]">
            <p className="text-[14px] font-semibold text-ink mb-1">
              Pick a plan to start sending review requests
            </p>
            <p className="text-[12.5px] text-text-soft leading-relaxed">
              Your locations are connected, but you haven&apos;t picked a
              plan yet — so the Plan, Billing, and Contract columns below
              are empty. Choose Self-Service or Full-Service to activate
              sending.
            </p>
          </div>
          <Link
            href="/app/billing"
            className="shrink-0 rounded-lg bg-forest px-4 py-2 text-[13px] font-medium text-cream hover:bg-forest-dark"
          >
            Choose a plan →
          </Link>
        </div>
      )}

      <LocationsToolbar
        view={view}
        sort={sort}
        plan={plan}
        billing={billing}
        managedBy={managedBy}
        connectedBy={connectedBy}
        q={q}
        total={total}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        managers={managerOptions}
        connectors={connectorOptions}
        canConnectGoogle={internal?.opsRole !== "account_manager"}
      />

      {view === "list" ? (
        <LocationsTable
          rows={paged}
          sort={sort}
          searchParamsString={searchParamsString}
          managers={managerOptions}
          page={page}
          perPage={PER_PAGE}
          total={total}
        />
      ) : (
        <GridView
          rows={paged}
          managers={managerOptions}
          billingMap={billingMap}
        />
      )}
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Grid view — the original card layout, kept for users who prefer it.
 * ──────────────────────────────────────────────────────────────────────── */
function GridView({
  rows,
  managers,
  billingMap,
}: {
  rows: LocationRow[];
  managers: AccountManagerOption[];
  billingMap: Map<string, LocationBillingSummary>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-base bg-paper/60 p-10 text-center max-w-2xl">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-forest/10 text-forest">
          <MapPin className="h-5 w-5" />
        </span>
        <h2 className="mt-4 font-display text-[20px] text-ink">
          No locations match
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-[14px] text-text-soft leading-relaxed">
          Clear filters above, or connect a new Google Business Profile.
        </p>
      </div>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 max-w-4xl">
      {rows.map((loc) => (
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
              {loc.assignments.length > 0 && (
                <p className="text-[12px] text-text-soft pt-0.5">
                  Managed by{" "}
                  <span className="text-ink">
                    {loc.assignments
                      .map((a) => a.full_name || a.email)
                      .join(", ")}
                  </span>
                </p>
              )}
              <div className="pt-1.5">
                <GridBillingBadge summary={billingMap.get(loc.id)} />
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
            {loc.canAssign && (
              <AssignManagerModal
                locationId={loc.id}
                locationName={loc.display_name}
                managers={managers}
                currentAssignments={loc.assignments}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function GridBillingBadge({
  summary,
}: {
  summary: LocationBillingSummary | undefined;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium";
  if (!summary || !summary.accountPlan) {
    return (
      <span className={`${base} bg-hover text-text-muted`}>No plan chosen</span>
    );
  }
  const planLabel =
    summary.accountPlan === "self_service" ? "Self-service" : "Full-service";
  if (!summary.locStatus) {
    return (
      <span className={`${base} bg-[#fbe6ec] text-[#a31a4f] ring-1 ring-inset ring-[#a31a4f]/20`}>
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
      <span className={`${base} bg-alert/10 text-alert`}>
        {planLabel} · past due{method}
      </span>
    );
  }
  return (
    <span className={`${base} bg-forest/10 text-forest`}>
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

/* ─────────────────────────────────────────────────────────────────────────
 * Billing-summary → table-friendly fields
 * ──────────────────────────────────────────────────────────────────────── */

function deriveBillingStatus(
  summary: LocationBillingSummary | undefined,
): LocationRow["billing_status"] {
  if (!summary || !summary.accountPlan) return null;
  if (!summary.locStatus) return "required";
  if (summary.canceling) return "canceling";
  if (summary.locStatus === "trialing") return "trialing";
  if (summary.locStatus === "past_due") return "past_due";
  if (summary.locStatus === "canceled") return "canceled";
  if (summary.locStatus === "active") return "active";
  return null;
}

function deriveContractDates(
  summary: LocationBillingSummary | undefined,
): {
  start: string | null;
  nextOrEnd: string | null;
  nextAmountCents: number | null;
} {
  if (!summary) return { start: null, nextOrEnd: null, nextAmountCents: null };
  return {
    start: summary.contractStart ?? null,
    nextOrEnd: summary.contractEnd ?? null,
    // Derived from plan, since locations.location_subscriptions doesn't
    // store the unit_amount. Hard-coded to match current Stripe prices:
    //   self_service: $99/mo · full_service: $399/mo
    nextAmountCents:
      summary.accountPlan === "self_service"
        ? 9900
        : summary.accountPlan === "full_service"
          ? 39900
          : null,
  };
}
