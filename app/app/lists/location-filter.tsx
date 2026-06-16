"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Building2 } from "lucide-react";

/**
 * Location filter for the Lists page. Pushes `?location=<id>` into the URL;
 * the server page narrows the list query to that location. "All locations"
 * clears it. Preserves the other params (filter, search).
 */
export function LocationFilter({
  locations,
  selected,
}: {
  locations: { id: string; name: string }[];
  selected: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(value: string) {
    const search = new URLSearchParams(params.toString());
    if (value) search.set("location", value);
    else search.delete("location");
    router.push(`${pathname}?${search.toString()}`);
  }

  return (
    <div className="relative">
      <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="w-[220px] appearance-none rounded-lg border border-border-base bg-paper py-2 pl-9 pr-8 text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-forest/30"
      >
        <option value="">All locations</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
  );
}
