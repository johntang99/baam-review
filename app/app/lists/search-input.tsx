"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

/**
 * Search box for the Lists page. Mirrors the controlled-input pattern
 * the customers/locations toolbars use: pushes `?q=…` into the URL on
 * submit or blur, the server page reads it and filters.
 */
export function ListsSearchInput({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);

  function commit(next: string) {
    const trimmed = next.trim();
    if (trimmed === initial.trim()) return;
    const search = new URLSearchParams(params.toString());
    if (trimmed) search.set("q", trimmed);
    else search.delete("q");
    router.push(`${pathname}?${search.toString()}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit(value);
      }}
      className="relative ml-auto"
    >
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => commit(value)}
        placeholder="Search lists or clients"
        className="w-[260px] rounded-lg border border-border-base bg-paper py-2 pl-9 pr-3 text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-forest/30"
      />
    </form>
  );
}
