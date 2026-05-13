"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ResolvedWidgetConfig } from "@/lib/widget/config";
import { ReviewCard, type WidgetReview } from "./review-card";

interface WidgetCarouselProps {
  items: WidgetReview[];
  cfg: ResolvedWidgetConfig;
  googleUrl: string | null;
}

/**
 * Horizontal scroll-snap carousel. Pure CSS handles the scrolling on touch
 * devices; arrow buttons add desktop affordance. Cards are 320px wide so
 * roughly 1.0–1.5 fit in a typical embed container.
 */
export function WidgetCarousel({
  items,
  cfg,
  googleUrl,
}: WidgetCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft < max - 8);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows]);

  function scrollBy(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-carousel-card]");
    const step = (card?.offsetWidth ?? 320) + 12;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="baam-carousel flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
        style={{
          scrollPaddingLeft: 4,
          scrollPaddingRight: 4,
        }}
      >
        {items.map((r) => (
          <div
            key={r.id}
            data-carousel-card
            className="snap-start flex-shrink-0"
            style={{ width: "min(320px, 86%)" }}
          >
            <ReviewCard review={r} cfg={cfg} googleUrl={googleUrl} />
          </div>
        ))}
      </div>

      {canPrev && (
        <ArrowButton
          direction="prev"
          accent={cfg.accentColor}
          onClick={() => scrollBy(-1)}
        />
      )}
      {canNext && (
        <ArrowButton
          direction="next"
          accent={cfg.accentColor}
          onClick={() => scrollBy(1)}
        />
      )}

      <style>{`
        .baam-carousel { scrollbar-width: none; -ms-overflow-style: none; }
        .baam-carousel::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

function ArrowButton({
  direction,
  accent,
  onClick,
}: {
  direction: "prev" | "next";
  accent: string;
  onClick: () => void;
}) {
  const isPrev = direction === "prev";
  return (
    <button
      type="button"
      aria-label={isPrev ? "Previous review" : "Next review"}
      onClick={onClick}
      className="absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border-base bg-paper text-text-soft shadow-md transition-colors hover:text-ink"
      style={{
        [isPrev ? "left" : "right"]: 6,
        color: accent,
      }}
    >
      {isPrev ? (
        <ChevronLeft className="h-5 w-5" />
      ) : (
        <ChevronRight className="h-5 w-5" />
      )}
    </button>
  );
}
