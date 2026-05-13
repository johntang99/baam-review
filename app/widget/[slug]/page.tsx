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

const WIDGET_STRINGS: Record<
  "en" | "zh" | "es",
  {
    basedOn: string;
    reviewSingular: string;
    reviewPlural: string;
    forName: string;
    leaveOwn: string;
    emptyTitle: (name: string) => string;
    emptySub: string;
    poweredBy: string;
    widgetUnavailable: string;
  }
> = {
  en: {
    basedOn: "Based on",
    reviewSingular: "Google review",
    reviewPlural: "Google reviews",
    forName: "for",
    leaveOwn: "Leave your own review",
    emptyTitle: (n) => `${n} hasn't received reviews matching this widget yet.`,
    emptySub: "Reviews appear here within a few hours of being posted on Google.",
    poweredBy: "Powered by BAAM Review",
    widgetUnavailable: "Widget unavailable — location not found.",
  },
  zh: {
    basedOn: "共",
    reviewSingular: "条 Google 评价",
    reviewPlural: "条 Google 评价",
    forName: "·",
    leaveOwn: "留下您的评价",
    emptyTitle: (n) => `${n} 暂无符合此小部件的评价。`,
    emptySub: "评价发布到 Google 后通常几小时内即可在此处显示。",
    poweredBy: "由 BAAM Review 提供技术支持",
    widgetUnavailable: "小部件不可用 — 未找到对应商家。",
  },
  es: {
    basedOn: "Basado en",
    reviewSingular: "reseña en Google",
    reviewPlural: "reseñas en Google",
    forName: "para",
    leaveOwn: "Deja tu propia reseña",
    emptyTitle: (n) => `${n} aún no tiene reseñas que coincidan con este widget.`,
    emptySub:
      "Las reseñas aparecen aquí pocas horas después de publicarse en Google.",
    poweredBy: "Con tecnología de BAAM Review",
    widgetUnavailable: "Widget no disponible — no se encontró la ubicación.",
  },
};

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
    lang?: string;
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const isPreview = sp.preview === "1";
  const lang =
    sp.lang === "zh" || sp.lang === "es" || sp.lang === "en" ? sp.lang : "en";
  const t = WIDGET_STRINGS[lang];

  const supabase = createServiceClient();
  const { data: location } = await supabase
    .from("locations")
    .select(
      "id, slug, display_name, brand_color, logo_url, google_review_url, widget_config",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!location) {
    return <WidgetMissing slug={slug} lang={lang} />;
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
                {t.basedOn}{" "}
                <span className="font-medium text-ink">
                  {aggregate.count}{" "}
                  {aggregate.count === 1
                    ? t.reviewSingular
                    : t.reviewPlural}
                </span>
              </p>
              <p className="text-[11.5px] text-text-muted">
                {t.forName} {location.display_name}
              </p>
            </div>
          </header>
        )}

        {items.length === 0 ? (
          <EmptyState locationName={location.display_name} t={t} />
        ) : cfg.layout === "compact" ? (
          <CompactList
            items={items}
            cfg={cfg}
            googleUrl={location.google_review_url}
            lang={lang}
          />
        ) : cfg.layout === "carousel" ? (
          <WidgetCarousel
            items={items}
            cfg={cfg}
            googleUrl={location.google_review_url}
            lang={lang}
          />
        ) : cfg.layout === "single" ? (
          <WidgetSingle
            items={items}
            cfg={cfg}
            googleUrl={location.google_review_url}
            lang={lang}
          />
        ) : (
          <CardGrid
            items={items}
            cfg={cfg}
            googleUrl={location.google_review_url}
            lang={lang}
          />
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
              {t.leaveOwn}
              <span aria-hidden>→</span>
            </a>
          </div>
        )}

        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-text-muted">
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-ink text-[7.5px] font-semibold text-cream">
            B
          </span>
          {t.poweredBy}
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
  lang,
}: {
  items: GoogleReview[];
  cfg: ReturnType<typeof resolveWidgetConfig>;
  googleUrl: string | null;
  lang: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((r) => (
        <ReviewCard
          key={r.id}
          review={r}
          cfg={cfg}
          googleUrl={googleUrl}
          lang={lang}
        />
      ))}
    </div>
  );
}

function CompactList({
  items,
  cfg,
  googleUrl,
  lang,
}: {
  items: GoogleReview[];
  cfg: ReturnType<typeof resolveWidgetConfig>;
  googleUrl: string | null;
  lang: string;
}) {
  return (
    <ul className="space-y-2.5">
      {items.map((r) => (
        <li key={r.id}>
          <CompactRow
            review={r}
            cfg={cfg}
            googleUrl={googleUrl}
            lang={lang}
          />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({
  locationName,
  t,
}: {
  locationName: string;
  t: (typeof WIDGET_STRINGS)["en"];
}) {
  return (
    <div className="rounded-2xl border border-border-base bg-paper px-5 py-8 text-center shadow-sm">
      <p className="font-display text-[16px] font-medium text-ink">
        {t.emptyTitle(locationName)}
      </p>
      <p className="mt-1 text-[12.5px] text-text-muted">{t.emptySub}</p>
    </div>
  );
}

function WidgetMissing({ slug, lang }: { slug: string; lang: "en" | "zh" | "es" }) {
  const message = WIDGET_STRINGS[lang].widgetUnavailable;
  return (
    <div
      style={{ background: "transparent" }}
      className="flex min-h-[140px] items-center justify-center p-5"
    >
      <p className="text-[12.5px] text-text-muted">
        {message} <code className="font-mono">{slug}</code>
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
