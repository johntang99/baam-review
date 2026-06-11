"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = [
  { key: "newest", label: "Newest first" },
  { key: "score_desc", label: "Highest score" },
  { key: "score_asc", label: "Lowest score" },
  { key: "name", label: "Business name (A–Z)" },
] as const;

type SortKey = (typeof OPTIONS)[number]["key"];

/** Sort control for /audit/list. Drives the `?sort=` query param; the page
 *  re-orders server-side. "newest" is the default and clears the param. */
export function SortDropdown({ current }: { current: SortKey }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const active = OPTIONS.find((o) => o.key === current) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function select(key: SortKey) {
    setOpen(false);
    router.push(key === "newest" ? "/audit/list" : `/audit/list?sort=${key}`);
  }

  return (
    <div className="sortdd" ref={ref}>
      <button
        type="button"
        className="sortdd-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Sorted: {active.label}
        <span className="sortdd-caret">▾</span>
      </button>
      {open && (
        <div className="sortdd-menu" role="menu">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              role="menuitemradio"
              aria-checked={o.key === active.key}
              className={`sortdd-item${o.key === active.key ? " active" : ""}`}
              onClick={() => select(o.key)}
            >
              <span className="sortdd-check">{o.key === active.key ? "✓" : ""}</span>
              {o.label}
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        .sortdd {
          position: relative;
        }
        .sortdd-trigger {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: "Onest", sans-serif;
          font-size: 12.5px;
          color: var(--text-soft, #555);
          background: transparent;
          border: 0;
          cursor: pointer;
          padding: 0;
        }
        .sortdd-trigger:hover {
          color: var(--ink, #1c1c1c);
        }
        .sortdd-caret {
          color: var(--gold-dark, #8a6d2f);
          font-size: 10px;
        }
        .sortdd-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          z-index: 50;
          min-width: 196px;
          background: var(--paper, #fff);
          border: 1px solid var(--border, #e3ddcf);
          border-radius: 10px;
          box-shadow: 0 16px 40px -16px rgba(28, 28, 28, 0.28);
          padding: 5px;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .sortdd-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          text-align: left;
          padding: 8px 10px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          font-family: "Onest", sans-serif;
          font-size: 13px;
          color: var(--text, #2a2a2a);
          cursor: pointer;
        }
        .sortdd-item:hover {
          background: var(--cream-deep, #f4efe2);
        }
        .sortdd-item.active {
          color: var(--ink, #1c1c1c);
          font-weight: 600;
        }
        .sortdd-check {
          width: 12px;
          flex: 0 0 auto;
          color: var(--forest, #2d4a3a);
          font-size: 11px;
        }
      `}</style>
    </div>
  );
}
