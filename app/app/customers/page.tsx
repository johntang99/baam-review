import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInternalContext } from "@/lib/auth/staff";
import { PageHeader } from "@/components/admin/page-header";
import { CustomersToolbar } from "./customers-toolbar";
import { CustomersTable } from "./customers-table";
import { fetchCustomers, type FetchCustomersOptions } from "./customers-data";

export const metadata = { title: "Customers — BAAM Review" };
export const dynamic = "force-dynamic";

const PER_PAGE = 50;

const VALID_SORTS = new Set<FetchCustomersOptions["sort"]>([
  "attention",
  "recent",
  "name_asc",
  "name_desc",
  "mrr_desc",
  "oldest",
]);

const VALID_PLANS = new Set(["", "self_service", "full_service"]);
const VALID_STATUSES = new Set([
  "",
  "trialing",
  "active",
  "past_due",
  "pending_gbp",
  "required",
  "canceling",
  "canceled",
]);
const VALID_SOURCES = new Set([
  "",
  "self_service",
  "start_now",
  "pending_start_now",
  "regular_sales",
]);

interface RawSearchParams {
  q?: string;
  plan?: string;
  status?: string;
  source?: string;
  managed_by?: string;
  connected_by?: string;
  sort?: string;
  page?: string;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/customers");

  const internal = await getInternalContext(supabase, user.id);
  if (!internal) redirect("/app");

  const q = (params.q ?? "").trim();
  const plan = (VALID_PLANS.has(params.plan ?? "")
    ? (params.plan ?? "")
    : "") as FetchCustomersOptions["plan"];
  const status = (VALID_STATUSES.has(params.status ?? "")
    ? (params.status ?? "")
    : "") as FetchCustomersOptions["status"];
  const source = (VALID_SOURCES.has(params.source ?? "")
    ? (params.source ?? "")
    : "") as FetchCustomersOptions["source"];
  const managedBy = params.managed_by ?? "";
  const connectedBy = params.connected_by ?? "";
  const sort = (
    VALID_SORTS.has(
      (params.sort ?? "attention") as FetchCustomersOptions["sort"],
    )
      ? (params.sort ?? "attention")
      : "attention"
  ) as FetchCustomersOptions["sort"];
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);

  // Rebuild URL params for child links (preserve other filters).
  const paramObj: Record<string, string> = {};
  if (q) paramObj.q = q;
  if (plan) paramObj.plan = plan;
  if (status) paramObj.status = status;
  if (source) paramObj.source = source;
  if (managedBy) paramObj.managed_by = managedBy;
  if (connectedBy) paramObj.connected_by = connectedBy;
  if (sort !== "attention") paramObj.sort = sort;
  if (page > 1) paramObj.page = String(page);
  const searchParamsString = new URLSearchParams(paramObj).toString();

  const result = await fetchCustomers({
    q,
    plan,
    status,
    source,
    managedBy,
    connectedBy,
    sort,
    page,
    perPage: PER_PAGE,
  });
  if (!result) redirect("/app");

  const showAdminFilters =
    internal.opsRole === "admin" || internal.opsRole === null;

  return (
    <main className="px-10 py-10 space-y-4">
      <PageHeader
        eyebrow="BAAM Operations"
        title="Customers"
        description={
          internal.opsRole === "account_manager"
            ? "Clients assigned to you. Filter, track billing status, and act on what needs attention."
            : internal.opsRole === "sales"
              ? "Clients you connected. Track billing, signups, and assigned managers."
              : "Every paying customer across Self-service, Start Now, and Regular Sales. Filter, sort, and dig into anyone."
        }
      />

      <CustomersToolbar
        plan={plan}
        status={status}
        source={source}
        managedBy={managedBy}
        connectedBy={connectedBy}
        q={q}
        sort={sort}
        total={result.total}
        rangeStart={result.rangeStart}
        rangeEnd={result.rangeEnd}
        managers={result.managers}
        connectors={result.connectors}
        showAdminFilters={showAdminFilters}
      />

      <CustomersTable
        rows={result.rows}
        total={result.total}
        page={page}
        perPage={PER_PAGE}
        searchParamsString={searchParamsString}
      />
    </main>
  );
}
