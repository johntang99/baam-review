import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import {
  getInternalContext,
  getVisibleLocationIds,
  type InternalUserContext,
} from "@/lib/auth/staff";
import { getLocationBillingMap } from "@/lib/billing/access";

export type CustomerSource =
  | "self_service"
  | "start_now"
  | "regular_sales"
  | "pending_start_now";

export type CustomerStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "pending_gbp"
  | "required"
  | "canceling"
  | "canceled";

export type CustomerPlan = "self_service" | "full_service";

export interface CustomerRow {
  /** Stable key for the row across sources. */
  rowKey: string;
  /** Underlying source so the UI can chip/badge it. */
  source: CustomerSource;
  /** Identity ids for click-through actions. */
  locationId: string | null;
  customerRecordId: string | null;
  accountId: string | null;
  /** Display fields. */
  name: string;
  address: string | null;
  email: string | null;
  plan: CustomerPlan | null;
  status: CustomerStatus | null;
  mrrCents: number | null;
  createdAt: string;
  connectedByUserId: string | null;
  connectedByName: string | null;
  managers: Array<{ user_id: string; full_name: string | null; email: string }>;
  /** Convenience flag the table uses to gate the inline "Connect GBP" action. */
  canConnectGbp: boolean;
}

export interface PersonOption {
  user_id: string;
  full_name: string | null;
  email: string;
}

export interface FetchCustomersOptions {
  q: string;
  plan: "" | CustomerPlan;
  status: "" | CustomerStatus;
  source: "" | CustomerSource;
  managedBy: string; // user_id | "unassigned" | ""
  connectedBy: string; // user_id | ""
  sort:
    | "attention"
    | "recent"
    | "name_asc"
    | "name_desc"
    | "mrr_desc"
    | "oldest";
  page: number;
  perPage: number;
}

export interface CustomersResult {
  rows: CustomerRow[];
  total: number;
  rangeStart: number;
  rangeEnd: number;
  /** Used to populate the toolbar's Manager and Sales filter dropdowns. */
  managers: PersonOption[];
  connectors: PersonOption[];
  internal: InternalUserContext;
}

/**
 * Fetch + unify customers from three sources, apply role-based visibility
 * AND user-supplied filters, sort, paginate. The set per user is bounded
 * (admin: at most a few hundred; staff: a handful), so sort + paginate in
 * JS — keeps the logic readable without sacrificing real-world perf.
 *
 * Returns null if the caller is not internal (the page redirects in that
 * case; the helper just signals it).
 */
export async function fetchCustomers(
  opts: FetchCustomersOptions,
): Promise<CustomersResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const internal = await getInternalContext(supabase, user.id);
  if (!internal) return null;

  const service = createServiceClient();

  // ── Source 1: BAAM Ops locations (filtered by role visibility) ────────
  const visibleIds = await getVisibleLocationIds(supabase, internal);

  const { data: opsAccount } = await service
    .from("accounts")
    .select("id")
    .eq("is_baam_internal", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const opsId = opsAccount?.id ?? null;

  let opsLocs: Array<{
    id: string;
    slug: string;
    display_name: string;
    address: string | null;
    connected_by_user_id: string | null;
    customer_record_id: string | null;
    created_at: string;
    account_id: string;
  }> = [];

  if (opsId) {
    let q = service
      .from("locations")
      .select(
        "id, slug, display_name, address, connected_by_user_id, customer_record_id, created_at, account_id",
      )
      .eq("account_id", opsId);
    if (visibleIds !== null) {
      q = q.in(
        "id",
        visibleIds.length > 0
          ? visibleIds
          : ["00000000-0000-0000-0000-000000000000"],
      );
    }
    const { data } = await q;
    opsLocs = data ?? [];
  }

  // Billing for those locations.
  const billingMap = await getLocationBillingMap(opsLocs.map((l) => l.id));

  // Assignments per location.
  const assignmentsByLoc = new Map<
    string,
    Array<{ user_id: string; full_name: string | null; email: string }>
  >();
  if (opsLocs.length > 0) {
    const { data: assignmentRows } = await service
      .from("location_assignments")
      .select("location_id, user_id, users!user_id(id, full_name)")
      .in(
        "location_id",
        opsLocs.map((l) => l.id),
      );
    // We need emails for managers, fetched in bulk below.
    for (const row of assignmentRows ?? []) {
      const rel = row.users;
      const u = Array.isArray(rel) ? rel[0] : rel;
      if (!u) continue;
      const existing = assignmentsByLoc.get(row.location_id) ?? [];
      existing.push({ user_id: u.id, full_name: u.full_name, email: "" });
      assignmentsByLoc.set(row.location_id, existing);
    }
  }

  // Customer-record rows (for Start Now-connected, and for pending if admin).
  const customerRecordIds = Array.from(
    new Set(
      opsLocs
        .map((l) => l.customer_record_id)
        .filter((id): id is string => !!id),
    ),
  );
  const { data: customerRecordsByLoc } =
    customerRecordIds.length > 0
      ? await service
          .from("customer_records")
          .select("id, email, business_name, business_address, created_at")
          .in("id", customerRecordIds)
      : { data: [] };
  const crById = new Map(
    (customerRecordsByLoc ?? []).map((cr) => [cr.id, cr]),
  );

  // ── Source 2: pending Start Now customer_records (admin only) ─────────
  let pendingRows: Array<{
    id: string;
    email: string;
    business_name: string | null;
    business_address: string | null;
    created_at: string;
  }> = [];
  if (internal.opsRole === "admin" || internal.opsRole === null) {
    const { data } = await service
      .from("customer_records")
      .select("id, email, business_name, business_address, created_at")
      .eq("onboarding_status", "pending_gbp_connect");
    pendingRows = data ?? [];
  }

  // ── Source 3: Self-service customers (admin only) ─────────────────────
  let selfServeAccounts: Array<{
    id: string;
    name: string;
    primary_email: string;
    created_at: string;
    review_plan: string | null;
    subscription_status: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  }> = [];
  if (internal.opsRole === "admin" || internal.opsRole === null) {
    const { data } = await service
      .from("accounts")
      .select(
        "id, name, primary_email, created_at, review_plan, subscription_status, current_period_end, cancel_at_period_end",
      )
      .eq("is_baam_internal", false);
    selfServeAccounts = data ?? [];
  }

  // ── Resolve sales/admin names (connected_by_user_id) for ops locations.
  const connectorIds = Array.from(
    new Set(
      opsLocs
        .map((l) => l.connected_by_user_id)
        .filter((id): id is string => !!id),
    ),
  );
  const { data: connectorUsers } =
    connectorIds.length > 0
      ? await service
          .from("users")
          .select("id, full_name")
          .in("id", connectorIds)
      : { data: [] };
  const connectorNameById = new Map(
    (connectorUsers ?? []).map((u) => [u.id, u.full_name]),
  );

  // Build connectorOptions for the toolbar (every connector who appears).
  const { data: authList } = await service.auth.admin.listUsers({
    perPage: 1000,
    page: 1,
  });
  const emailByUserId = new Map(
    (authList?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );

  const connectorOptions: PersonOption[] = (connectorUsers ?? []).map((u) => ({
    user_id: u.id,
    full_name: u.full_name,
    email: emailByUserId.get(u.id) ?? "",
  }));

  // Backfill manager emails now that we have the auth map.
  for (const list of assignmentsByLoc.values()) {
    for (const a of list) {
      a.email = emailByUserId.get(a.user_id) ?? "";
    }
  }

  // Manager pool (every user with ops_role=account_manager).
  const { data: allManagers } = await service
    .from("users")
    .select("id, full_name")
    .eq("ops_role", "account_manager");
  const managerOptions: PersonOption[] = (allManagers ?? []).map((m) => ({
    user_id: m.id,
    full_name: m.full_name,
    email: emailByUserId.get(m.id) ?? "",
  }));

  // ── Compose CustomerRow ───────────────────────────────────────────────
  const rows: CustomerRow[] = [];

  for (const l of opsLocs) {
    const cr = l.customer_record_id ? crById.get(l.customer_record_id) : null;
    const b = billingMap.get(l.id);
    const isStartNow = !!l.customer_record_id;
    rows.push({
      rowKey: `loc:${l.id}`,
      source: isStartNow ? "start_now" : "regular_sales",
      locationId: l.id,
      customerRecordId: cr?.id ?? null,
      accountId: l.account_id,
      name: l.display_name,
      address: l.address,
      email: cr?.email ?? null,
      plan: (b?.accountPlan ?? null) as CustomerPlan | null,
      status: deriveStatusFromBilling(b),
      mrrCents: mrrForPlan(b?.accountPlan ?? null),
      createdAt: l.created_at,
      connectedByUserId: l.connected_by_user_id,
      connectedByName: l.connected_by_user_id
        ? connectorNameById.get(l.connected_by_user_id) ?? null
        : null,
      managers: assignmentsByLoc.get(l.id) ?? [],
      canConnectGbp: false,
    });
  }

  for (const cr of pendingRows) {
    rows.push({
      rowKey: `cr:${cr.id}`,
      source: "pending_start_now",
      locationId: null,
      customerRecordId: cr.id,
      accountId: null,
      name: cr.business_name ?? `(no business name) — ${cr.email}`,
      address: cr.business_address,
      email: cr.email,
      plan: "full_service",
      status: "pending_gbp",
      mrrCents: 39900,
      createdAt: cr.created_at,
      connectedByUserId: null,
      connectedByName: null,
      managers: [],
      canConnectGbp:
        internal.opsRole === "admin" ||
        internal.opsRole === "sales" ||
        internal.opsRole === null,
    });
  }

  for (const a of selfServeAccounts) {
    rows.push({
      rowKey: `acc:${a.id}`,
      source: "self_service",
      locationId: null,
      customerRecordId: null,
      accountId: a.id,
      name: a.name,
      address: null,
      email: a.primary_email,
      plan: "self_service",
      status: deriveStatusFromAccount(a),
      mrrCents: a.review_plan === "self_service" ? 9900 : null,
      createdAt: a.created_at,
      connectedByUserId: null,
      connectedByName: null,
      managers: [],
      canConnectGbp: false,
    });
  }

  // ── Filters ──────────────────────────────────────────────────────────
  let filtered = rows;
  if (opts.plan) filtered = filtered.filter((r) => r.plan === opts.plan);
  if (opts.status) filtered = filtered.filter((r) => r.status === opts.status);
  if (opts.source) filtered = filtered.filter((r) => r.source === opts.source);
  if (opts.managedBy === "unassigned") {
    filtered = filtered.filter(
      (r) =>
        (r.source === "start_now" || r.source === "regular_sales") &&
        r.managers.length === 0,
    );
  } else if (opts.managedBy) {
    filtered = filtered.filter((r) =>
      r.managers.some((m) => m.user_id === opts.managedBy),
    );
  }
  if (opts.connectedBy)
    filtered = filtered.filter(
      (r) => r.connectedByUserId === opts.connectedBy,
    );
  if (opts.q) {
    const needle = opts.q.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        (r.address ?? "").toLowerCase().includes(needle) ||
        (r.email ?? "").toLowerCase().includes(needle),
    );
  }

  // ── Sort ─────────────────────────────────────────────────────────────
  filtered = [...filtered].sort((a, b) => {
    if (opts.sort === "name_asc") return a.name.localeCompare(b.name);
    if (opts.sort === "name_desc") return b.name.localeCompare(a.name);
    if (opts.sort === "recent")
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (opts.sort === "mrr_desc") return (b.mrrCents ?? 0) - (a.mrrCents ?? 0);
    if (opts.sort === "oldest")
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    // attention default
    const p = (s: CustomerStatus | null) =>
      s === "pending_gbp"
        ? 0
        : s === "required"
          ? 1
          : s === "past_due"
            ? 2
            : s === "trialing"
              ? 3
              : s === "canceling"
                ? 4
                : s === "active"
                  ? 5
                  : s === "canceled"
                    ? 6
                    : 7;
    const pa = p(a.status);
    const pb = p(b.status);
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const total = filtered.length;
  const paged = filtered.slice(
    (opts.page - 1) * opts.perPage,
    opts.page * opts.perPage,
  );
  const rangeStart = total === 0 ? 0 : (opts.page - 1) * opts.perPage + 1;
  const rangeEnd = Math.min(opts.page * opts.perPage, total);

  return {
    rows: paged,
    total,
    rangeStart,
    rangeEnd,
    managers: managerOptions,
    connectors: connectorOptions,
    internal,
  };
}

type Billing = Awaited<ReturnType<typeof getLocationBillingMap>> extends Map<
  string,
  infer T
>
  ? T
  : never;

function deriveStatusFromBilling(b: Billing | undefined): CustomerStatus | null {
  if (!b) return null;
  if (!b.accountPlan) return null;
  if (!b.locStatus) return "required";
  if (b.canceling) return "canceling";
  if (b.locStatus === "trialing") return "trialing";
  if (b.locStatus === "past_due") return "past_due";
  if (b.locStatus === "canceled") return "canceled";
  if (b.locStatus === "active") return "active";
  return null;
}

function deriveStatusFromAccount(a: {
  subscription_status: string | null;
  cancel_at_period_end: boolean;
  review_plan: string | null;
}): CustomerStatus | null {
  if (!a.review_plan) return "required";
  if (a.cancel_at_period_end) return "canceling";
  switch (a.subscription_status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return null;
  }
}

function mrrForPlan(plan: string | null): number | null {
  if (plan === "self_service") return 9900;
  if (plan === "full_service") return 39900;
  return null;
}
