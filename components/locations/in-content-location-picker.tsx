"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";

export interface LocationPickerLocation {
  id: string;
  display_name: string;
  brand_color: string | null;
  logo_url: string | null;
}

interface InContentLocationPickerProps {
  locations: LocationPickerLocation[];
  currentId: string;
  /**
   * Where to navigate when the user picks a different location. We replace
   * the [id] segment with the new value and preserve the subpath. e.g.
   * if `subPath` is "/reviews", picking Oishi from Dr. Huang's reviews page
   * navigates to /app/locations/<oishi>/reviews.
   *
   * If omitted, we derive the subpath from the current pathname.
   */
  subPath?: string;
}

export function InContentLocationPicker({
  locations,
  currentId,
  subPath,
}: InContentLocationPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  const current =
    locations.find((l) => l.id === currentId) ?? null;

  // Resolve the subpath after the [id] segment (e.g., "/reviews", "/qr", "").
  const resolvedSub =
    subPath ??
    (() => {
      const m = pathname.match(/^\/app\/locations\/[^/]+(\/.*)?$/);
      return m && m[1] ? m[1] : "";
    })();

  function pick(id: string) {
    setOpen(false);
    router.push(`/app/locations/${id}${resolvedSub}`);
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2.5 rounded-xl border border-border-base bg-paper px-3 py-2 text-left shadow-sm hover:bg-hover transition-colors min-w-[260px]"
      >
        {current && <Badge loc={current} />}
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] text-ink truncate">
            {current?.display_name ?? "Pick a location"}
          </span>
          <span className="block text-[11px] uppercase tracking-[0.12em] text-text-muted">
            Editing location
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-1.5 max-h-[60vh] min-w-[280px] overflow-y-auto rounded-xl border border-border-base bg-paper p-1 shadow-lg"
        >
          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => pick(loc.id)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13.5px] text-text hover:bg-hover"
            >
              <Badge loc={loc} size="sm" />
              <span className="min-w-0 flex-1 truncate">{loc.display_name}</span>
              {loc.id === currentId && (
                <Check className="h-3.5 w-3.5 text-forest flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({
  loc,
  size = "md",
}: {
  loc: LocationPickerLocation;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7 text-[12px]" : "h-9 w-9 text-[13px]";
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
