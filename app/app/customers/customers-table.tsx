import Link from "next/link";
import {
  Settings,
  ArrowRight,
  Users as UsersIcon,
  Building2,
} from "lucide-react";
import type { CustomerRow } from "./customers-data";

const SOURCE_CHIP: Record<
  CustomerRow["source"],
  { label: string; cls: string }
> = {
  self_service: { label: "Self-service", cls: "bg-forest/10 text-forest" },
  start_now: { label: "Start Now", cls: "bg-gold/15 text-gold-dark" },
  pending_start_now: {
    label: "Pending Start Now",
    cls: "bg-[#fbe6ec] text-[#a31a4f]",
  },
  regular_sales: { label: "Sales", cls: "bg-sage-soft text-forest-dark" },
};

const PLAN_CHIP: Record<NonNullable<CustomerRow["plan"]>, string> = {
  self_service: "bg-forest/10 text-forest",
  full_service: "bg-gold/15 text-gold-dark",
};
const PLAN_LABEL: Record<NonNullable<CustomerRow["plan"]>, string> = {
  self_service: "Self-service",
  full_service: "Full-service",
};

const STATUS_CHIP: Record<NonNullable<CustomerRow["status"]>, string> = {
  trialing: "bg-gold/15 text-gold-dark",
  active: "bg-success/10 text-success",
  past_due: "bg-alert/10 text-alert",
  // Magenta accent for the two states that need action.
  pending_gbp:
    "bg-[#fbe6ec] text-[#a31a4f] ring-1 ring-inset ring-[#a31a4f]/20 before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-[#c8265e]",
  required:
    "bg-[#fbe6ec] text-[#a31a4f] ring-1 ring-inset ring-[#a31a4f]/20 before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-[#c8265e]",
  canceling: "bg-alert/10 text-alert",
  canceled: "bg-text-muted/10 text-text-muted",
};
const STATUS_LABEL: Record<NonNullable<CustomerRow["status"]>, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  pending_gbp: "Pending GBP",
  required: "Billing required",
  canceling: "Canceling",
  canceled: "Canceled",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatMrr(cents: number | null): string {
  if (cents == null) return "—";
  return `$${Math.round(cents / 100)}/mo`;
}

function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  if (current > 3) out.push("…");
  for (
    let i = Math.max(2, current - 1);
    i <= Math.min(total - 1, current + 1);
    i++
  )
    out.push(i);
  if (current < total - 2) out.push("…");
  out.push(total);
  return out;
}

function buildPageHref(searchParamsString: string, page: number): string {
  const params = new URLSearchParams(searchParamsString);
  if (page <= 1) params.delete("page");
  else params.set("page", String(page));
  const qs = params.toString();
  return qs ? `?${qs}` : "?";
}

interface TableProps {
  rows: CustomerRow[];
  total: number;
  page: number;
  perPage: number;
  searchParamsString: string;
}

export function CustomersTable({
  rows,
  total,
  page,
  perPage,
  searchParamsString,
}: TableProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pages = pageNumbers(page, totalPages);

  return (
    <div>
      <div className="rounded-2xl border border-border-base bg-paper overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-cream-deep/40 text-left text-[11px] uppercase tracking-[0.08em] text-text-muted">
              <tr>
                <th className="px-3.5 py-2.5 font-medium">Customer</th>
                <th className="px-3.5 py-2.5 font-medium">Plan · Status</th>
                <th className="px-3.5 py-2.5 font-medium hidden md:table-cell">
                  MRR
                </th>
                <th className="px-3.5 py-2.5 font-medium hidden lg:table-cell">
                  Signed up
                </th>
                <th className="px-3.5 py-2.5 font-medium hidden xl:table-cell">
                  Sales
                </th>
                <th className="px-3.5 py-2.5 font-medium hidden md:table-cell">
                  Manager
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
                    <Building2 className="h-5 w-5 text-text-muted mx-auto mb-2" />
                    <p className="text-[14px] text-ink">
                      No customers match the current filters.
                    </p>
                    <p className="text-[12.5px] text-text-muted mt-1">
                      Clear filters or wait for the next signup.
                    </p>
                  </td>
                </tr>
              )}
              {rows.map((c, idx) => (
                <tr
                  key={c.rowKey}
                  className={`border-t border-border-soft ${idx % 2 === 1 ? "bg-cream-deep/[0.18]" : ""} hover:bg-hover transition-colors`}
                >
                  {/* Customer */}
                  <td className="px-3.5 py-3 min-w-0">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-forest/10 text-forest font-display text-[15px]">
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p
                          className="font-medium text-ink truncate max-w-[260px]"
                          title={c.name}
                        >
                          {c.name}
                        </p>
                        {(c.address || c.email) && (
                          <p className="text-[11.5px] text-text-muted truncate max-w-[260px]">
                            {c.address ? `${c.address}` : ""}
                            {c.address && c.email ? " · " : ""}
                            {c.email}
                          </p>
                        )}
                        <p className="mt-1">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${SOURCE_CHIP[c.source].cls}`}
                          >
                            {SOURCE_CHIP[c.source].label}
                          </span>
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Plan · Status */}
                  <td className="px-3.5 py-3">
                    <div className="flex flex-col gap-1">
                      {c.plan && (
                        <span
                          className={`inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[11.5px] font-medium ${PLAN_CHIP[c.plan]}`}
                        >
                          {PLAN_LABEL[c.plan]}
                        </span>
                      )}
                      {c.status && (
                        <span
                          className={`inline-flex w-fit items-center gap-1.5 px-2 py-0.5 rounded-full text-[11.5px] font-medium ${STATUS_CHIP[c.status]}`}
                        >
                          {STATUS_LABEL[c.status]}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* MRR */}
                  <td className="px-3.5 py-3 hidden md:table-cell text-ink">
                    {formatMrr(c.mrrCents)}
                  </td>

                  {/* Signed up */}
                  <td className="px-3.5 py-3 hidden lg:table-cell text-text-soft">
                    {formatDate(c.createdAt)}
                  </td>

                  {/* Sales */}
                  <td className="px-3.5 py-3 hidden xl:table-cell">
                    {c.connectedByName ? (
                      <div className="flex flex-col leading-tight">
                        <span className="text-[12.5px] text-ink">
                          {c.connectedByName}
                        </span>
                        {c.connectedViaGoogleEmail && (
                          <span className="text-[11px] text-text-muted">
                            via {c.connectedViaGoogleEmail}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-text-muted text-[12px]">—</span>
                    )}
                  </td>

                  {/* Manager */}
                  <td className="px-3.5 py-3 hidden md:table-cell">
                    {c.managers.length === 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] text-text-muted border border-dashed border-border-base">
                        {c.source === "self_service" ? "Self-managed" : "—"}
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {c.managers.map((m) => (
                          <span
                            key={m.user_id}
                            className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2 py-0.5 text-[11.5px] text-forest-dark"
                            title={m.email}
                          >
                            <UsersIcon className="h-2.5 w-2.5" />
                            {m.full_name || m.email.split("@")[0]}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3.5 py-3">
                    <div className="flex justify-end items-center gap-1">
                      {c.locationId && (
                        <Link
                          href={`/app/locations/${c.locationId}`}
                          className="inline-flex h-7 px-2 items-center gap-1 rounded-md border border-border-base text-[12px] text-text-soft hover:bg-hover hover:text-ink"
                        >
                          <Settings className="h-3.5 w-3.5" />
                          Settings
                        </Link>
                      )}
                      {c.source === "pending_start_now" && c.canConnectGbp && (
                        <Link
                          href={`/app/locations/connect/picker?customer_record=${c.customerRecordId}`}
                          className="inline-flex h-7 px-2 items-center gap-1 rounded-md bg-forest text-cream text-[12px] hover:bg-forest-dark"
                        >
                          Connect GBP
                          <ArrowRight className="h-3 w-3" />
                        </Link>
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
