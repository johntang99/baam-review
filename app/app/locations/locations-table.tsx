import Link from "next/link";
import {
  Settings,
  Star,
  QrCode,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  MapPin,
} from "lucide-react";
import {
  AssignManagerModal,
  type AccountManagerOption,
  type AssignedManager,
} from "./assignments/assign-manager-modal";
import type { SortOption } from "./locations-toolbar";

export interface LocationRow {
  id: string;
  slug: string;
  display_name: string;
  address: string | null;
  business_type: string | null;
  brand_color: string | null;
  logo_url: string | null;
  connected_by_user_id: string | null;
  connected_by_name: string | null;
  connected_via_google_email: string | null;
  plan: "self_service" | "full_service" | null;
  billing_status:
    | "trialing"
    | "active"
    | "past_due"
    | "required"
    | "canceling"
    | "canceled"
    | null;
  contract_start: string | null;
  contract_next_or_end: string | null;
  contract_next_amount_cents: number | null;
  assignments: AssignedManager[];
  canAssign: boolean;
}

interface LocationsTableProps {
  rows: LocationRow[];
  sort: SortOption;
  searchParamsString: string;
  managers: AccountManagerOption[];
  page: number;
  perPage: number;
  total: number;
  pathname?: string;
}

const BILLING_CLS: Record<
  NonNullable<LocationRow["billing_status"]>,
  string
> = {
  trialing: "bg-gold/15 text-gold-dark",
  active: "bg-success/10 text-success",
  past_due: "bg-alert/10 text-alert",
  // Eye-catching magenta for the one state that requires human action.
  required:
    "bg-[#fbe6ec] text-[#a31a4f] ring-1 ring-inset ring-[#a31a4f]/20 before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-[#c8265e]",
  canceling: "bg-alert/10 text-alert",
  canceled: "bg-text-muted/10 text-text-muted",
};

const BILLING_LABEL: Record<
  NonNullable<LocationRow["billing_status"]>,
  string
> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  required: "Billing required",
  canceling: "Canceling",
  canceled: "Canceled",
};

const PLAN_LABEL = {
  self_service: "Self-service",
  full_service: "Full-service",
} as const;

const PLAN_CLS = {
  self_service: "bg-forest/10 text-forest",
  full_service: "bg-gold/15 text-gold-dark",
} as const;

function buildSortHref(
  searchParamsString: string,
  newSort: SortOption,
): string {
  const params = new URLSearchParams(searchParamsString);
  if (newSort === "attention") params.delete("sort");
  else params.set("sort", newSort);
  params.delete("page");
  const qs = params.toString();
  return qs ? `?${qs}` : "?";
}

function buildPageHref(searchParamsString: string, page: number): string {
  const params = new URLSearchParams(searchParamsString);
  if (page <= 1) params.delete("page");
  else params.set("page", String(page));
  const qs = params.toString();
  return qs ? `?${qs}` : "?";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatAmount(cents: number | null): string {
  if (cents == null) return "";
  const dollars = Math.round(cents / 100);
  return `$${dollars}`;
}

function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const out: (number | "…")[] = [1];
  if (current > 3) out.push("…");
  for (
    let i = Math.max(2, current - 1);
    i <= Math.min(total - 1, current + 1);
    i++
  ) {
    out.push(i);
  }
  if (current < total - 2) out.push("…");
  out.push(total);
  return out;
}

export function LocationsTable({
  rows,
  sort,
  searchParamsString,
  managers,
  page,
  perPage,
  total,
}: LocationsTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pages = pageNumbers(page, totalPages);

  return (
    <div>
      <div className="rounded-2xl border border-border-base bg-paper overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-cream-deep/40 text-left text-[11px] uppercase tracking-[0.08em] text-text-muted">
              <tr>
                <SortHeader
                  current={sort}
                  asc="name_asc"
                  desc="name_desc"
                  searchParamsString={searchParamsString}
                >
                  Location
                </SortHeader>
                <SortHeader
                  current={sort}
                  asc={null}
                  desc={null}
                  one="attention"
                  searchParamsString={searchParamsString}
                  hide
                >
                  Plan
                </SortHeader>
                <SortHeader
                  current={sort}
                  asc={null}
                  desc={null}
                  one="attention"
                  searchParamsString={searchParamsString}
                >
                  Billing
                </SortHeader>
                <SortHeader
                  current={sort}
                  asc={null}
                  desc={null}
                  one="oldest_contract"
                  searchParamsString={searchParamsString}
                  className="hidden lg:table-cell"
                >
                  Contract
                </SortHeader>
                <th className="px-3.5 py-2.5 font-medium hidden md:table-cell">
                  Managed by
                </th>
                <th className="px-3.5 py-2.5 font-medium hidden xl:table-cell">
                  Connected by
                </th>
                <th className="px-3.5 py-2.5 font-medium text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <MapPin className="h-5 w-5 text-text-muted mx-auto mb-2" />
                    <p className="text-[14px] text-ink">
                      No locations match the current filters.
                    </p>
                    <p className="text-[12.5px] text-text-muted mt-1">
                      Clear filters or connect a new GBP to get started.
                    </p>
                  </td>
                </tr>
              )}

              {rows.map((loc, idx) => (
                <tr
                  key={loc.id}
                  className={`border-t border-border-soft ${idx % 2 === 1 ? "bg-cream-deep/[0.18]" : ""} hover:bg-hover transition-colors`}
                >
                  {/* Location */}
                  <td className="px-3.5 py-3 min-w-0">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {loc.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={loc.logo_url}
                          alt=""
                          className="h-9 w-9 rounded-md object-cover flex-shrink-0"
                        />
                      ) : (
                        <span
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-cream font-display text-[15px]"
                          style={{
                            backgroundColor: loc.brand_color ?? "#1F4D3F",
                          }}
                        >
                          {loc.display_name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/app/locations/${loc.id}`}
                          title={loc.display_name}
                          className="block font-medium text-ink hover:underline truncate max-w-[260px]"
                        >
                          {loc.display_name}
                        </Link>
                        <p className="text-[11.5px] text-text-muted truncate max-w-[260px]">
                          {loc.business_type
                            ? `${loc.business_type}${loc.address ? ` · ${loc.address}` : ""}`
                            : loc.address ?? ""}
                        </p>
                        <p className="text-[11.5px] text-text-soft truncate max-w-[260px]">
                          /r/{loc.slug}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Plan */}
                  <td className="px-3.5 py-3">
                    {loc.plan ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] font-medium ${PLAN_CLS[loc.plan]}`}
                      >
                        {PLAN_LABEL[loc.plan]}
                      </span>
                    ) : (
                      <span className="text-text-muted text-[12px]">—</span>
                    )}
                  </td>

                  {/* Billing */}
                  <td className="px-3.5 py-3">
                    {loc.billing_status ? (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11.5px] font-medium ${BILLING_CLS[loc.billing_status]}`}
                      >
                        {BILLING_LABEL[loc.billing_status]}
                      </span>
                    ) : (
                      <span className="text-text-muted text-[12px]">—</span>
                    )}
                  </td>

                  {/* Contract */}
                  <td className="px-3.5 py-3 hidden lg:table-cell">
                    <div className="text-[12px] leading-snug">
                      {loc.contract_start && (
                        <div className="text-ink">
                          Started {formatDate(loc.contract_start)}
                        </div>
                      )}
                      {loc.contract_next_or_end && (
                        <div className="text-text-soft">
                          {loc.billing_status === "canceling" ||
                          loc.billing_status === "canceled"
                            ? `Ends ${formatDate(loc.contract_next_or_end)}`
                            : `Next ${formatDate(loc.contract_next_or_end)}${loc.contract_next_amount_cents ? ` — ${formatAmount(loc.contract_next_amount_cents)}` : ""}`}
                        </div>
                      )}
                      {!loc.contract_start && !loc.contract_next_or_end && (
                        <span className="text-text-muted">—</span>
                      )}
                    </div>
                  </td>

                  {/* Managed by */}
                  <td className="px-3.5 py-3 hidden md:table-cell">
                    {loc.assignments.length === 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] text-text-muted border border-dashed border-border-base">
                        {loc.plan === "self_service"
                          ? "Self-managed"
                          : "Unassigned"}
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {loc.assignments.map((a) => (
                          <span
                            key={a.user_id}
                            className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2 py-0.5 text-[11.5px] text-forest-dark"
                            title={a.email}
                          >
                            {a.full_name || a.email.split("@")[0]}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Connected by */}
                  <td className="px-3.5 py-3 hidden xl:table-cell">
                    {loc.connected_by_name ? (
                      <div className="flex flex-col leading-tight">
                        <span
                          className="text-[12px] text-ink"
                          title={loc.connected_by_user_id ?? ""}
                        >
                          {loc.connected_by_name}
                        </span>
                        {loc.connected_via_google_email && (
                          <span className="text-[11px] text-text-muted">
                            via {loc.connected_via_google_email}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-text-muted text-[12px]">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3.5 py-3">
                    <div className="flex justify-end items-center gap-0.5">
                      <ActionIconLink
                        href={`/app/locations/${loc.id}/reviews`}
                        label="Reviews"
                        icon={<Star className="h-3.5 w-3.5" />}
                      />
                      <ActionIconLink
                        href={`/app/locations/${loc.id}/qr`}
                        label="QR poster"
                        icon={<QrCode className="h-3.5 w-3.5" />}
                      />
                      <ActionIconLink
                        href={`/app/locations/${loc.id}`}
                        label="Settings"
                        icon={<Settings className="h-3.5 w-3.5" />}
                      />
                      {loc.canAssign && (
                        <AssignManagerModal
                          locationId={loc.id}
                          locationName={loc.display_name}
                          managers={managers}
                          currentAssignments={loc.assignments}
                          triggerLabel="Assign"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between flex-wrap gap-3 text-[12.5px] text-text-soft">
        <div>
          Showing{" "}
          <strong className="text-ink">
            {total === 0 ? 0 : (page - 1) * perPage + 1}–
            {Math.min(page * perPage, total)}
          </strong>{" "}
          of <strong className="text-ink">{total}</strong>
        </div>
        <div className="inline-flex gap-1 items-center">
          <PageLink
            href={buildPageHref(searchParamsString, Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            ‹
          </PageLink>
          {pages.map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1.5 text-text-muted">
                …
              </span>
            ) : (
              <PageLink
                key={p}
                href={buildPageHref(searchParamsString, p)}
                active={p === page}
              >
                {p}
              </PageLink>
            ),
          )}
          <PageLink
            href={buildPageHref(
              searchParamsString,
              Math.min(totalPages, page + 1),
            )}
            disabled={page >= totalPages}
          >
            ›
          </PageLink>
        </div>
      </div>
    </div>
  );
}

function SortHeader({
  current,
  asc,
  desc,
  one,
  searchParamsString,
  children,
  hide,
  className,
}: {
  current: SortOption;
  asc?: SortOption | null;
  desc?: SortOption | null;
  one?: SortOption;
  searchParamsString: string;
  children: React.ReactNode;
  hide?: boolean;
  className?: string;
}) {
  const sortable = (asc && desc) || one;
  if (!sortable) {
    return (
      <th className={`px-3.5 py-2.5 font-medium ${className ?? ""}`}>
        {children}
      </th>
    );
  }
  // For columns with bi-directional sort (asc/desc), toggle. For "one"
  // sort columns, just switch to that sort (no direction toggle).
  let nextSort: SortOption;
  let icon: React.ReactNode;
  if (asc && desc) {
    if (current === asc) {
      nextSort = desc;
      icon = <ArrowDown className="h-3 w-3" />;
    } else if (current === desc) {
      nextSort = "attention";
      icon = <ArrowUp className="h-3 w-3" />;
    } else {
      nextSort = asc;
      icon = (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      );
    }
  } else {
    nextSort = one as SortOption;
    icon =
      current === one ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      );
  }
  const isActive =
    current === asc || current === desc || current === one;
  return (
    <th
      className={`px-3.5 py-2.5 font-medium ${className ?? ""} ${hide ? "" : ""} ${isActive ? "bg-cream-deep/60 text-ink" : ""}`}
    >
      <Link
        href={buildSortHref(searchParamsString, nextSort)}
        className="inline-flex items-center gap-1 hover:text-ink cursor-pointer"
      >
        {children}
        <span className={isActive ? "text-forest" : ""}>{icon}</span>
      </Link>
    </th>
  );
}

function ActionIconLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-soft hover:bg-hover hover:text-ink transition-colors"
    >
      {icon}
    </Link>
  );
}

function PageLink({
  href,
  active,
  disabled,
  children,
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="min-w-[28px] h-7 px-2 rounded-md border border-border-base bg-paper text-text-muted inline-flex items-center justify-center opacity-40">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`min-w-[28px] h-7 px-2 rounded-md border inline-flex items-center justify-center text-[12.5px] ${
        active
          ? "bg-ink border-ink text-cream"
          : "border-border-base bg-paper hover:bg-hover"
      }`}
    >
      {children}
    </Link>
  );
}
