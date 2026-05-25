"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import {
  Search,
  ChevronDown,
  LayoutGrid,
  ListIcon,
} from "lucide-react";

export type SortOption =
  | "attention"
  | "recent"
  | "name_asc"
  | "name_desc"
  | "last_review"
  | "oldest_contract";

export type ViewMode = "list" | "grid";

export type PlanFilter = "" | "self_service" | "full_service";
export type BillingFilter =
  | ""
  | "trialing"
  | "active"
  | "past_due"
  | "required"
  | "canceling"
  | "canceled";

export interface PersonOption {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface ToolbarProps {
  view: ViewMode;
  sort: SortOption;
  plan: PlanFilter;
  billing: BillingFilter;
  managedBy: string; // user_id, "unassigned", or ""
  connectedBy: string; // user_id or ""
  q: string;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  managers: PersonOption[];
  connectors: PersonOption[];
  canConnectGoogle: boolean;
}

const SORT_LABELS: Record<SortOption, string> = {
  attention: "Needs attention first",
  recent: "Most recent",
  name_asc: "Name (A–Z)",
  name_desc: "Name (Z–A)",
  last_review: "Last reviewed",
  oldest_contract: "Oldest contract",
};

const PLAN_LABELS: Record<PlanFilter, string> = {
  "": "All",
  self_service: "Self-service",
  full_service: "Full-service",
};

const BILLING_LABELS: Record<BillingFilter, string> = {
  "": "All",
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  required: "Billing required",
  canceling: "Canceling",
  canceled: "Canceled",
};

export function LocationsToolbar({
  view,
  sort,
  plan,
  billing,
  managedBy,
  connectedBy,
  q,
  total,
  rangeStart,
  rangeEnd,
  managers,
  connectors,
  canConnectGoogle,
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
      // Whenever filters / sort change, reset to page 1 so the user
      // isn't stranded on a page that no longer exists in the new set.
      if (Object.keys(updates).some((k) => k !== "page")) {
        next.delete("page");
      }
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
      <form onSubmit={onSearchSubmit} className="relative flex-1 min-w-[220px]">
        <Search className="h-3.5 w-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onBlur={() =>
            searchValue.trim() !== q.trim() &&
            updateParam({ q: searchValue.trim() || null })
          }
          placeholder="Search by business name, address, slug…"
          className="w-full rounded-md border border-border-base bg-cream-deep/30 pl-8 pr-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-forest/30"
        />
      </form>

      <FilterSelect
        label="Plan"
        value={plan}
        valueLabel={PLAN_LABELS[plan]}
        options={[
          { value: "", label: "All" },
          { value: "self_service", label: "Self-service" },
          { value: "full_service", label: "Full-service" },
        ]}
        onChange={(v) => updateParam({ plan: v || null })}
      />

      <FilterSelect
        label="Billing"
        value={billing}
        valueLabel={BILLING_LABELS[billing]}
        options={[
          { value: "", label: "All" },
          { value: "trialing", label: "Trialing" },
          { value: "active", label: "Active" },
          { value: "past_due", label: "Past due" },
          { value: "required", label: "Billing required" },
          { value: "canceling", label: "Canceling" },
          { value: "canceled", label: "Canceled" },
        ]}
        onChange={(v) => updateParam({ billing: v || null })}
      />

      <FilterSelect
        label="Managed by"
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
        label="Connected by"
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
        options={(
          [
            "attention",
            "recent",
            "name_asc",
            "name_desc",
            "last_review",
            "oldest_contract",
          ] as SortOption[]
        ).map((s) => ({ value: s, label: SORT_LABELS[s] }))}
        onChange={(v) => updateParam({ sort: v === "attention" ? null : v })}
      />

      <div className="ml-auto flex items-center gap-2 text-[12px] text-text-muted">
        <span>
          Showing <strong className="text-ink">{rangeStart}–{rangeEnd}</strong>{" "}
          of <strong className="text-ink">{total}</strong>
        </span>
        <span className="inline-flex rounded-md border border-border-base bg-paper p-0.5">
          <button
            type="button"
            onClick={() => updateParam({ view: view === "list" ? null : null })}
            className={`px-2 py-1 rounded text-[12px] inline-flex items-center gap-1 ${
              view === "list"
                ? "bg-ink text-cream"
                : "text-text-soft hover:bg-hover"
            }`}
            aria-pressed={view === "list"}
          >
            <ListIcon className="h-3.5 w-3.5" />
            List
          </button>
          <button
            type="button"
            onClick={() => updateParam({ view: view === "grid" ? null : "grid" })}
            className={`px-2 py-1 rounded text-[12px] inline-flex items-center gap-1 ${
              view === "grid"
                ? "bg-ink text-cream"
                : "text-text-soft hover:bg-hover"
            }`}
            aria-pressed={view === "grid"}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
          </button>
        </span>
      </div>
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
