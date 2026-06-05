"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ExternalLink, Globe, Search } from "lucide-react";

interface ProductSwitcherProps {
  /** Which product the user is currently inside. Drives the active check
   *  mark in the menu and the title shown on the trigger. Defaults to
   *  "review" since this component lives in the BAAM Review sidebar. */
  active?: "review" | "audit" | "marketing";
}

const PRODUCTS = [
  {
    key: "review" as const,
    title: "BAAM Review",
    subtitle: "Reviews · Referrals · Revenue",
    href: "/app",
    icon: "B",
    external: false,
  },
  {
    key: "audit" as const,
    title: "BAAM Review Audit",
    subtitle: "Free reputation audit reports",
    href: "/audit",
    icon: "audit",
    external: false,
  },
  {
    key: "marketing" as const,
    title: "Marketing site",
    subtitle: "Public homepage · baamreview.com",
    href: "/",
    icon: "globe",
    external: false,
  },
];

/**
 * Sidebar logo + product switcher dropdown. Click the BAAM Review logo
 * at the top of the sidebar to open a menu jumping to:
 *
 *   • BAAM Review        (this app — marked active)
 *   • BAAM Review Audit  → /audit
 *   • Marketing site     → /
 *
 * Auth session is shared across all three, so jumping between them is
 * a normal in-app navigation (no re-login). The dropdown closes on
 * outside-click, Escape, or item selection.
 */
export function ProductSwitcher({ active = "review" }: ProductSwitcherProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (wrapperRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative px-2 pb-4">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="group flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left hover:bg-cream/[0.06]"
      >
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gold text-ink font-semibold text-[13px]">
          B
        </span>
        <span className="font-display text-[17px] font-medium tracking-tight text-cream">
          BAAM Review
        </span>
        <ChevronDown
          className={`ml-auto h-4 w-4 flex-shrink-0 text-cream/40 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-2 right-2 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border-base bg-paper shadow-lg"
        >
          <div className="border-b border-border-soft bg-cream-deep/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-semibold">
              Switch product
            </p>
          </div>
          <ul className="py-1">
            {PRODUCTS.map((p) => {
              const isActive = p.key === active;
              const Inner = (
                <>
                  <ProductIcon kind={p.icon} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
                      {p.title}
                      {isActive && (
                        <Check className="h-3.5 w-3.5 text-forest" />
                      )}
                    </div>
                    <div className="text-[11.5px] text-text-muted truncate">
                      {p.subtitle}
                    </div>
                  </div>
                  {!isActive && (
                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-text-muted/60" />
                  )}
                </>
              );
              return (
                <li key={p.key}>
                  {isActive ? (
                    // Current product — render as non-link row so clicking
                    // it (already there) just closes the menu.
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left bg-forest/[0.04]"
                      role="menuitem"
                    >
                      {Inner}
                    </button>
                  ) : (
                    <Link
                      href={p.href}
                      onClick={() => setOpen(false)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 hover:bg-cream-deep/40"
                      role="menuitem"
                    >
                      {Inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function ProductIcon({ kind }: { kind: string }) {
  if (kind === "B") {
    return (
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-gold text-ink font-semibold text-[14px]">
        B
      </span>
    );
  }
  if (kind === "audit") {
    return (
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-forest/15 text-forest">
        <Search className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-text-muted/15 text-text-soft">
      <Globe className="h-4 w-4" />
    </span>
  );
}
