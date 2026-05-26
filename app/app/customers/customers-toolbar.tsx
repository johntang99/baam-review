"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import type { PersonOption } from "./customers-data";

const PLAN_LABELS = {
  "": "All",
  self_service: "Self-service",
  full_service: "Full-service",
} as const;

const STATUS_LABELS = {
  "": "All",
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  pending_gbp: "Pending GBP",
  required: "Billing required",
  canceling: "Canceling",
  canceled: "Canceled",
} as const;

const SOURCE_LABELS = {
  "": "All",
  self_service: "Self-service",
  start_now: "Start Now",
  pending_start_now: "Pending Start Now",
  regular_sales: "Regular Sales",
} as const;

const SORT_LABELS = {
  attention: "Needs attention first",
  recent: "Most recent",
  name_asc: "Name (A–Z)",
  name_desc: "Name (Z–A)",
  mrr_desc: "Highest MRR",
  oldest: "Oldest customer",
} as const;

type PlanKey = keyof typeof PLAN_LABELS;
type StatusKey = keyof typeof STATUS_LABELS;
type SourceKey = keyof typeof SOURCE_LABELS;
type SortKey = keyof typeof SORT_LABELS;

interface ToolbarProps {
  plan: PlanKey;
  status: StatusKey;
  source: SourceKey;
  managedBy: string;
  connectedBy: string;
  q: string;
  sort: SortKey;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  managers: PersonOption[];
  connectors: PersonOption[];
  showAdminFilters: boolean;
}

export function CustomersToolbar({
  plan,
  status,
  source,
  managedBy,
  connectedBy,
  q,
  sort,
  total,
  rangeStart,
  rangeEnd,
  managers,
  connectors,
  showAdminFilters,
}: ToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [searchValue, setSearchValue] = useState(q);

  const updateParam = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (Object.keys(updates).some((k) => k !== "page")) next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam({ q: searchValue.trim() || null });
  };

  const managerNameById = new Map(
    managers.map((m) => [m.user_id, m.full_name || m.email]),
  );
  const connectorNameById = new Map(
    connectors.map((c) => [c.user_id, c.full_name || c.email]),
  );

  return (
    <div className="rounded-2xl border border-border-base bg-paper p-3.5 flex flex-wrap items-center gap-2.5 mb-3.5">
      <form
        onSubmit={onSearchSubmit}
        className="relative flex-1 min-w-[220px]"
      >
        <Search className="h-3.5 w-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onBlur={() =>
            searchValue.trim() !== q.trim() &&
            updateParam({ q: searchValue.trim() || null })
          }
          placeholder="Search by business name, address, or email…"
          className="w-full rounded-md border border-border-base bg-cream-deep/30 pl-8 pr-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-forest/30"
        />
      </form>

      <FilterSelect
        label="Plan"
        value={plan}
        valueLabel={PLAN_LABELS[plan]}
        options={Object.entries(PLAN_LABELS).map(([v, l]) => ({
          value: v,
          label: l,
        }))}
        onChange={(v) => updateParam({ plan: v || null })}
      />

      <FilterSelect
        label="Status"
        value={status}
        valueLabel={STATUS_LABELS[status]}
        options={Object.entries(STATUS_LABELS).map(([v, l]) => ({
          value: v,
          label: l,
        }))}
        onChange={(v) => updateParam({ status: v || null })}
      />

      {showAdminFilters && (
        <FilterSelect
          label="Source"
          value={source}
          valueLabel={SOURCE_LABELS[source]}
          options={Object.entries(SOURCE_LABELS).map(([v, l]) => ({
            value: v,
            label: l,
          }))}
          onChange={(v) => updateParam({ source: v || null })}
        />
      )}

      <FilterSelect
        label="Manager"
        value={managedBy}
        valueLabel={
          managedBy === "unassigned"
            ? "Unassigned"
            : managerNameById.get(managedBy) || "Any"
        }
        options={[
          { value: "", label: "Any" },
          { value: "unassigned", label: "Unassigned" },
          ...managers.map((m) => ({
            value: m.user_id,
            label: m.full_name || m.email,
          })),
        ]}
        onChange={(v) => updateParam({ managed_by: v || null })}
      />

      <FilterSelect
        label="Sales"
        value={connectedBy}
        valueLabel={connectorNameById.get(connectedBy) || "Any"}
        options={[
          { value: "", label: "Any" },
          ...connectors.map((c) => ({
            value: c.user_id,
            label: c.full_name || c.email,
          })),
        ]}
        onChange={(v) => updateParam({ connected_by: v || null })}
      />

      <FilterSelect
        label="Sort"
        value={sort}
        valueLabel={SORT_LABELS[sort]}
        options={Object.entries(SORT_LABELS).map(([v, l]) => ({
          value: v,
          label: l,
        }))}
        onChange={(v) => updateParam({ sort: v === "attention" ? null : v })}
      />

      <span className="ml-auto text-[12px] text-text-muted">
        Showing <strong className="text-ink">{rangeStart}–{rangeEnd}</strong>{" "}
        of <strong className="text-ink">{total}</strong>
      </span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  valueLabel,
  options,
  onChange,
}: {
  label: string;
  value: string;
  valueLabel: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const isActive = value !== "" && value !== "attention";
  return (
    <label
      className={`relative inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12.5px] cursor-pointer ${
        isActive
          ? "border-forest bg-forest/[0.06]"
          : "border-border-base bg-cream-deep/30 hover:bg-cream-deep/50"
      }`}
    >
      <span className="text-text-muted">{label}:</span>
      <span className="text-ink font-medium">{valueLabel}</span>
      <ChevronDown className="h-3 w-3 text-text-muted" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
