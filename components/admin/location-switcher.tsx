"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Plus, LayoutGrid, Globe } from "lucide-react";

export interface LocationSwitcherLocation {
  id: string;
  display_name: string;
  address: string | null;
  brand_color: string | null;
  logo_url: string | null;
}

interface LocationSwitcherProps {
  locations: LocationSwitcherLocation[];
  selectedId: string | null;
}

export function LocationSwitcher({
  locations,
  selectedId,
}: LocationSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + escape.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = locations.find((l) => l.id === selectedId) ?? null;

  async function pick(value: string | null) {
    await fetch("/api/select-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-cream/10 bg-cream/[0.04] px-2.5 py-2 text-left transition-colors hover:bg-cream/[0.08]"
      >
        {selected ? (
          <LocationBadge loc={selected} />
        ) : (
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-cream/10 text-cream/70">
            <Globe className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-cream truncate">
            {selected ? selected.display_name : "All locations"}
          </span>
          <span className="block text-[11px] text-cream/55 truncate">
            {selected
              ? selected.address ?? "—"
              : `${locations.length} location${locations.length === 1 ? "" : "s"}`}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 flex-shrink-0 text-cream/55 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 right-0 z-40 mt-1.5 max-h-[60vh] overflow-y-auto rounded-xl border border-cream/10 bg-ink/95 backdrop-blur p-1 shadow-2xl"
        >
          <button
            type="button"
            onClick={() => pick(null)}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-cream/85 hover:bg-cream/[0.06] hover:text-cream"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-cream/10 text-cream/70">
              <Globe className="h-3.5 w-3.5" />
            </span>
            <span className="flex-1">All locations</span>
            {selectedId === null && (
              <Check className="h-3.5 w-3.5 text-gold" />
            )}
          </button>

          {locations.length > 0 && (
            <div className="my-1 h-px bg-cream/10" />
          )}

          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => pick(loc.id)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-cream/85 hover:bg-cream/[0.06] hover:text-cream"
            >
              <LocationBadge loc={loc} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{loc.display_name}</span>
                {loc.address && (
                  <span className="block text-[10.5px] text-cream/45 truncate">
                    {loc.address}
                  </span>
                )}
              </span>
              {selectedId === loc.id && (
                <Check className="h-3.5 w-3.5 text-gold flex-shrink-0" />
              )}
            </button>
          ))}

          <div className="my-1 h-px bg-cream/10" />

          <Link
            href="/api/auth/google/start"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-cream/85 hover:bg-cream/[0.06] hover:text-cream"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gold/15 text-gold">
              <Plus className="h-3.5 w-3.5" />
            </span>
            <span className="flex-1">Connect a new location</span>
          </Link>

          <Link
            href="/app/locations"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-cream/85 hover:bg-cream/[0.06] hover:text-cream"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-cream/10 text-cream/70">
              <LayoutGrid className="h-3.5 w-3.5" />
            </span>
            <span className="flex-1">Manage all locations</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function LocationBadge({
  loc,
  size = "md",
}: {
  loc: LocationSwitcherLocation;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7 text-[12px]" : "h-8 w-8 text-[13px]";
  if (loc.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={loc.logo_url}
        alt=""
        className={`flex-shrink-0 rounded-md object-cover ${dim}`}
      />
    );
  }
  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center rounded-md font-display text-cream ${dim}`}
      style={{ backgroundColor: loc.brand_color ?? "#1F4D3F" }}
    >
      {loc.display_name.charAt(0).toUpperCase()}
    </span>
  );
}
