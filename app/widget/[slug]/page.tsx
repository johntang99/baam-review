import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveWidgetConfig } from "@/lib/widget/config";
import type { WidgetConfig } from "@/lib/database.types";
import { WidgetTracker } from "./widget-tracker";

export const dynamic = "force-dynamic";

interface GoogleReview {
  id: string;
  google_review_id: string;
  reviewer_display_name: string | null;
  rating: number;
  comment: string | null;
  review_create_time: string;
  reply_comment: string | null;
}

export default async function WidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "1";

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

  const cfg = resolveWidgetConfig(
    location.widget_config as WidgetConfig | null,
    location.brand_color ?? "#1F4D3F",
  );

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
          <header className="mb-4 flex items-center gap-3 rounded-2xl border border-border-base bg-paper px-4 py-3 shadow-sm">
            <Stars rating={aggregate.average} accent={cfg.accentColor} />
            <div className="flex-1 leading-tight">
              <p className="font-display text-[16.5px] font-medium tracking-[-0.01em] text-ink">
                {aggregate.average.toFixed(1)}{" "}
                <span className="text-[13px] text-text-muted">
                  / 5 · {aggregate.count} review
                  {aggregate.count === 1 ? "" : "s"}
                </span>
              </p>
              <p className="text-[11.5px] text-text-muted">
                via Google · {location.display_name}
              </p>
            </div>
          </header>
        )}

        {items.length === 0 ? (
          <EmptyState locationName={location.display_name} />
        ) : cfg.layout === "compact" ? (
          <CompactList items={items} cfg={cfg} googleUrl={location.google_review_url} />
        ) : (
          <CardGrid items={items} cfg={cfg} googleUrl={location.google_review_url} />
        )}

        {cfg.showLeaveOwn && (
          <div className="mt-5 flex justify-center">
            <a
              href={`${baseUrl}/r/${location.slug}?source=widget`}
              target="_top"
              data-action="leave_own"
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-medium transition-all hover:-translate-y-px hover:shadow-md"
              style={{ background: cfg.accentColor, color: "#FAF7F2" }}
            >
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
          <a
            href={googleUrl ?? "#"}
            target="_top"
            rel="noopener noreferrer"
            data-action="review_click"
            data-review-id={r.google_review_id}
            className="block rounded-xl border border-border-base bg-paper px-4 py-3 shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-[13.5px] font-medium text-ink">
                {r.reviewer_display_name ?? "Verified customer"}
              </p>
              <Stars rating={r.rating} accent={cfg.accentColor} small />
            </div>
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-text-soft">
              {r.comment}
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}

function ReviewCard({
  review,
  cfg,
  googleUrl,
}: {
  review: GoogleReview;
  cfg: ReturnType<typeof resolveWidgetConfig>;
  googleUrl: string | null;
}) {
  const initials = (review.reviewer_display_name ?? "?")
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
  return (
    <a
      href={googleUrl ?? "#"}
      target="_top"
      rel="noopener noreferrer"
      data-action="review_click"
      data-review-id={review.google_review_id}
      className="flex h-full flex-col gap-3 rounded-2xl border border-border-base bg-paper p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <Stars rating={review.rating} accent={cfg.accentColor} />
        <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
          {formatDate(review.review_create_time)}
        </span>
      </div>
      <p className="line-clamp-5 flex-1 text-[14px] leading-relaxed text-text">
        {review.comment}
      </p>
      <div className="mt-1 flex items-center gap-2.5 border-t border-border-soft pt-3">
        <span
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold text-cream"
          style={{ background: cfg.accentColor }}
        >
          {initials || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-ink">
            {review.reviewer_display_name ?? "Verified customer"}
          </p>
          <p className="text-[10.5px] text-text-muted">via Google</p>
        </div>
      </div>
      {cfg.showReply && review.reply_comment && (
        <div className="rounded-lg bg-cream-deep px-3 py-2">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
            Owner response
          </p>
          <p className="line-clamp-3 text-[12px] leading-snug text-text-soft">
            {review.reply_comment}
          </p>
        </div>
      )}
    </a>
  );
}

function Stars({
  rating,
  accent,
  small = false,
}: {
  rating: number;
  accent: string;
  small?: boolean;
}) {
  const filled = Math.round(rating);
  return (
    <span
      className={
        small ? "text-[13px] tracking-[1.5px]" : "text-[15px] tracking-[2px]"
      }
      style={{ color: accent }}
      aria-label={`${rating} out of 5`}
    >
      {"★".repeat(filled)}
      <span className="opacity-25">{"★".repeat(5 - filled)}</span>
    </span>
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

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const days = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days < 1) return "Today";
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
  } catch {
    return "";
  }
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
