import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveWidgetConfig } from "@/lib/widget/config";
import type { WidgetConfig } from "@/lib/database.types";
import {
  ReviewCard,
  CompactRow,
  Stars,
  type WidgetReview,
} from "@/components/widget/review-card";
import { WidgetCarousel } from "@/components/widget/widget-carousel";
import { WidgetSingle } from "@/components/widget/widget-single";
import { WidgetTracker } from "./widget-tracker";

export const dynamic = "force-dynamic";

type GoogleReview = WidgetReview;

export default async function WidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    preview?: string;
    layout?: string;
    accent?: string;
    min_rating?: string;
    max?: string;
    aggregate?: string;
    leave_own?: string;
    reply?: string;
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const isPreview = sp.preview === "1";

  const supabase = createServiceClient();
  const { data: location } = await supabase
    .from("locations")
    .select(
      "id, slug, display_name, brand_color, logo_url, google_review_url, widget_config",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!location) {
    return <WidgetMissing slug={slug} />;
  }

  // Start from the saved config, then layer URL overrides on top. Any
  // present override wins; absent fields fall back to the saved value.
  // preview=1 only suppresses widget_events writes — it does NOT gate
  // visual overrides, so a clinic site can configure its homepage widget
  // via JSON without touching the BAAM admin.
  let cfg = resolveWidgetConfig(
    location.widget_config as WidgetConfig | null,
    location.brand_color ?? "#1F4D3F",
  );
  const accent =
    sp.accent && /^#[0-9a-fA-F]{6}$/.test(sp.accent)
      ? sp.accent
      : cfg.accentColor;
  const minRating =
    sp.min_rating === "5" ? 5 : sp.min_rating === "4" ? 4 : cfg.minRating;
  const max = sp.max
    ? Math.max(3, Math.min(20, Number(sp.max) || cfg.maxCount))
    : cfg.maxCount;
  const layoutOverride: typeof cfg.layout | null =
    sp.layout === "cards"
      ? "cards"
      : sp.layout === "compact"
        ? "compact"
        : sp.layout === "carousel"
          ? "carousel"
          : sp.layout === "single"
            ? "single"
            : null;
  cfg = {
    ...cfg,
    layout: layoutOverride ?? cfg.layout,
    accentColor: accent,
    minRating,
    maxCount: max,
    showAggregate:
      sp.aggregate === "1" ? true : sp.aggregate === "0" ? false : cfg.showAggregate,
    showLeaveOwn:
      sp.leave_own === "1" ? true : sp.leave_own === "0" ? false : cfg.showLeaveOwn,
    showReply: sp.reply === "1" ? true : sp.reply === "0" ? false : cfg.showReply,
  };

  const { data: reviews } = await supabase
    .from("google_reviews")
    .select(
      "id, google_review_id, reviewer_display_name, rating, comment, review_create_time, reply_comment",
    )
    .eq("location_id", location.id)
    .gte("rating", cfg.minRating)
    .not("comment", "is", null)
    .order("review_create_time", { ascending: false })
    .limit(cfg.maxCount);

  const items = (reviews ?? []) as GoogleReview[];

  // Aggregate across ALL reviews (not just the curated subset) so the rating
  // matches what Google shows on the customer's listing.
  const { data: aggRows } = await supabase
    .from("google_reviews")
    .select("rating")
    .eq("location_id", location.id);
  const allRatings = (aggRows ?? []).map((r) => r.rating);
  const aggregate = computeAggregate(allRatings);

  // Origin captured for telemetry. embed.js posts the parent origin via a
  // query param so we don't have to rely on Referer (which dev tools can
  // strip). Falls back to Referer when not provided.
  const h = await headers();
  const refOrigin = h.get("referer") ?? null;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://review.baamplatform.com";

  const jsonLd = buildJsonLd({
    name: location.display_name,
    aggregate,
    items,
    baseUrl,
    slug: location.slug,
  });

  return (
    <>
      {/* Body bg override — when the widget is embedded the iframe wraps a
          full HTML document, so we need to force the body transparent so
          the embedding site's background bleeds through. */}
      <style>{`
        html, body { background: transparent !important; }
        body { margin: 0; padding: 0; }
      `}</style>

      {/* Structured data for SEO + AI engine citations */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div
        className="px-4 py-5 sm:px-5 sm:py-6"
        style={{ "--accent": cfg.accentColor } as React.CSSProperties}
      >
        {cfg.showAggregate && aggregate.count > 0 && (
          <header className="mb-6 flex flex-col items-center gap-1.5 rounded-2xl border border-border-base bg-paper px-5 py-5 text-center shadow-sm sm:flex-row sm:justify-center sm:gap-4 sm:text-left">
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-[32px] font-medium leading-none tracking-[-0.02em] text-ink">
                {aggregate.average.toFixed(1)}
              </span>
              <Stars rating={aggregate.average} accent={cfg.accentColor} />
            </div>
            <div className="leading-tight">
              <p className="text-[13.5px] text-text">
                Based on{" "}
                <span className="font-medium text-ink">
                  {aggregate.count} Google review
                  {aggregate.count === 1 ? "" : "s"}
                </span>
              </p>
              <p className="text-[11.5px] text-text-muted">
                for {location.display_name}
              </p>
            </div>
          </header>
        )}

        {items.length === 0 ? (
          <EmptyState locationName={location.display_name} />
        ) : cfg.layout === "compact" ? (
          <CompactList items={items} cfg={cfg} googleUrl={location.google_review_url} />
        ) : cfg.layout === "carousel" ? (
          <WidgetCarousel
            items={items}
            cfg={cfg}
            googleUrl={location.google_review_url}
          />
        ) : cfg.layout === "single" ? (
          <WidgetSingle
            items={items}
            cfg={cfg}
            googleUrl={location.google_review_url}
          />
        ) : (
          <CardGrid items={items} cfg={cfg} googleUrl={location.google_review_url} />
        )}

        {cfg.showLeaveOwn && (
          <div className="mt-7 flex justify-center">
            <a
              href={
                location.google_review_url
                  ? location.google_review_url
                  : `${baseUrl}/r/${location.slug}?source=widget`
              }
              target="_blank"
              rel="noopener noreferrer"
              data-action="leave_own"
              className="inline-flex items-center gap-2.5 rounded-full px-8 py-4 text-[15.5px] font-semibold shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              style={{ background: cfg.accentColor, color: "#FAF7F2" }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
              Leave your own review
              <span aria-hidden>→</span>
            </a>
          </div>
        )}

        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-text-muted">
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-ink text-[7.5px] font-semibold text-cream">
            B
          </span>
          Powered by BAAM Review
        </div>
      </div>

      <WidgetTracker
        locationId={location.id}
        origin={refOrigin}
        isPreview={isPreview}
      />
    </>
  );
}

function CardGrid({
  items,
  cfg,
  googleUrl,
}: {
  items: GoogleReview[];
  cfg: ReturnType<typeof resolveWidgetConfig>;
  googleUrl: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((r) => (
        <ReviewCard key={r.id} review={r} cfg={cfg} googleUrl={googleUrl} />
      ))}
    </div>
  );
}

function CompactList({
  items,
  cfg,
  googleUrl,
}: {
  items: GoogleReview[];
  cfg: ReturnType<typeof resolveWidgetConfig>;
  googleUrl: string | null;
}) {
  return (
    <ul className="space-y-2.5">
      {items.map((r) => (
        <li key={r.id}>
          <CompactRow review={r} cfg={cfg} googleUrl={googleUrl} />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ locationName }: { locationName: string }) {
  return (
    <div className="rounded-2xl border border-border-base bg-paper px-5 py-8 text-center shadow-sm">
      <p className="font-display text-[16px] font-medium text-ink">
        {locationName} hasn&apos;t received reviews matching this widget yet.
      </p>
      <p className="mt-1 text-[12.5px] text-text-muted">
        Reviews appear here within a few hours of being posted on Google.
      </p>
    </div>
  );
}

function WidgetMissing({ slug }: { slug: string }) {
  return (
    <div
      style={{ background: "transparent" }}
      className="flex min-h-[140px] items-center justify-center p-5"
    >
      <p className="text-[12.5px] text-text-muted">
        Widget unavailable — location <code>{slug}</code> not found.
      </p>
    </div>
  );
}

function computeAggregate(ratings: number[]): {
  average: number;
  count: number;
} {
  if (ratings.length === 0) return { average: 0, count: 0 };
  const sum = ratings.reduce((a, b) => a + b, 0);
  return { average: sum / ratings.length, count: ratings.length };
}

function buildJsonLd(opts: {
  name: string;
  aggregate: { average: number; count: number };
  items: GoogleReview[];
  baseUrl: string;
  slug: string;
}) {
  const reviews = opts.items.map((r) => ({
    "@type": "Review",
    reviewRating: {
      "@type": "Rating",
      ratingValue: r.rating,
      bestRating: 5,
      worstRating: 1,
    },
    author: {
      "@type": "Person",
      name: r.reviewer_display_name ?? "Verified customer",
    },
    reviewBody: r.comment,
    datePublished: r.review_create_time,
  }));

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: opts.name,
    url: `${opts.baseUrl}/r/${opts.slug}`,
    ...(opts.aggregate.count > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: Number(opts.aggregate.average.toFixed(1)),
        reviewCount: opts.aggregate.count,
        bestRating: 5,
        worstRating: 1,
      },
    }),
    review: reviews,
  };
}
