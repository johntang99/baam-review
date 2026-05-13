"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ResolvedWidgetConfig } from "@/lib/widget/config";
import { ReviewCard, type WidgetReview } from "./review-card";

interface WidgetSingleProps {
  items: WidgetReview[];
  cfg: ResolvedWidgetConfig;
  googleUrl: string | null;
}

const ROTATE_MS = 7000;

/**
 * One review at a time, auto-rotating every 7s. Pauses on hover, on focus,
 * and when the reduced-motion media query is on. Prev/next arrows and dots
 * for manual control.
 */
export function WidgetSingle({ items, cfg, googleUrl }: WidgetSingleProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  // Respect prefers-reduced-motion. When on, we disable auto-rotate entirely.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(m.matches);
    onChange();
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (items.length <= 1 || paused || reducedMotion) return;
    timer.current = window.setTimeout(() => {
      setIndex((i) => (i + 1) % items.length);
    }, ROTATE_MS);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [index, items.length, paused, reducedMotion]);

  if (items.length === 0) return null;
  const review = items[Math.min(index, items.length - 1)];
  const showArrows = items.length > 1;

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ReviewCard
        review={review}
        cfg={cfg}
        googleUrl={googleUrl}
        fullHeight={false}
      />

      {showArrows && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="Previous review"
            onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border-base bg-paper text-text-soft transition-colors hover:text-ink"
            style={{ color: cfg.accentColor }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1.5">
            {items.map((_, i) => {
              const active = i === index;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Review ${i + 1}`}
                  aria-current={active}
                  onClick={() => setIndex(i)}
                  className={
                    "h-1.5 rounded-full transition-all " +
                    (active ? "w-5" : "w-1.5 bg-border-base hover:bg-text-muted")
                  }
                  style={
                    active
                      ? { background: cfg.accentColor }
                      : undefined
                  }
                />
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Next review"
            onClick={() => setIndex((i) => (i + 1) % items.length)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border-base bg-paper text-text-soft transition-colors hover:text-ink"
            style={{ color: cfg.accentColor }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
