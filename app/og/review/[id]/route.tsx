import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/service";
import {
  resolveSize,
  resolveTheme,
  SHARE_SIZES,
} from "@/lib/share/themes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Share-card image for any Google review.
 *
 * Path: /og/review/<google_review_id>?size=og|square|story&theme=warm-clinic|forest-pro|gold-luxe|quiet-cream|bold-dark
 *
 * Returns PNG sized per the prototype 07 brand voice: brand-accent gradient,
 * Fraunces-feel italic quote, ★★★★★ in gold, attribution row with logo. The
 * three sizes cover OG link previews, square social posts, and vertical
 * stories.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const size = resolveSize(url.searchParams.get("size"));
  const theme = resolveTheme(url.searchParams.get("theme"));
  const { width, height } = SHARE_SIZES[size];

  const supabase = createServiceClient();

  const { data: review } = await supabase
    .from("google_reviews")
    .select(
      "id, google_review_id, reviewer_display_name, rating, comment, review_create_time, location_id",
    )
    .eq("google_review_id", id)
    .maybeSingle();
  if (!review) {
    return new Response("Not found", { status: 404 });
  }

  const { data: loc } = await supabase
    .from("locations")
    .select("display_name, address, brand_color, default_share_theme")
    .eq("id", review.location_id)
    .maybeSingle();
  if (!loc) return new Response("Not found", { status: 404 });

  const brand = loc.brand_color ?? "#1F4D3F";
  const themeUse =
    url.searchParams.get("theme") === null && loc.default_share_theme
      ? resolveTheme(loc.default_share_theme)
      : theme;

  const bg = themeUse.background(brand);
  const accent = themeUse.accent(brand);
  const initial = loc.display_name.charAt(0).toUpperCase();

  // Truncate quote so layout doesn't blow out. Story / square get a tighter
  // budget than OG.
  const maxLen = size === "og" ? 260 : size === "square" ? 220 : 200;
  const quote = (review.comment ?? "").trim();
  const trimmed = quote.length > maxLen ? quote.slice(0, maxLen - 1).trimEnd() + "…" : quote;

  // Per-size font sizes. ImageResponse uses inline fontSizes since we don't
  // ship a custom font (system serif fallback handles Fraunces well enough
  // for raster output).
  const fonts = size === "og"
    ? { mark: 18, stars: 56, quote: 50, attr: 22, name: 28, sub: 18, footer: 16 }
    : size === "square"
      ? { mark: 18, stars: 60, quote: 56, attr: 22, name: 30, sub: 18, footer: 16 }
      : { mark: 20, stars: 72, quote: 64, attr: 26, name: 32, sub: 20, footer: 18 };

  const padding = size === "story" ? 80 : 64;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: bg,
          color: themeUse.fg,
          padding,
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div
            style={{
              padding: "6px 14px",
              background:
                themeUse.key === "quiet-cream"
                  ? "rgba(15,31,26,0.08)"
                  : "rgba(255,255,255,0.18)",
              color: themeUse.markText,
              borderRadius: 999,
              fontSize: fonts.mark,
              letterSpacing: 2,
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ color: accent }}>★</span>
            Recommended by a customer
          </div>
        </div>

        <div
          style={{
            display: "flex",
            color: accent,
            fontSize: fonts.stars,
            letterSpacing: 8,
          }}
        >
          {"★".repeat(Math.max(1, Math.min(5, review.rating)))}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: fonts.quote,
            lineHeight: 1.15,
            fontStyle: "italic",
            fontWeight: 400,
            maxWidth: size === "story" ? 920 : 1000,
          }}
        >
          “{trimmed}”
        </div>

        <div style={{ flex: 1 }} />

        {review.reviewer_display_name && (
          <div
            style={{
              display: "flex",
              fontSize: fonts.attr,
              color: themeUse.fgMuted,
              marginBottom: 28,
            }}
          >
            — {review.reviewer_display_name}, satisfied customer
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${themeUse.key === "quiet-cream" ? "rgba(15,31,26,0.15)" : "rgba(255,255,255,0.22)"}`,
            paddingTop: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 14,
                background: themeUse.logoBg,
                color: themeUse.logoColor(brand),
                fontSize: 40,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {initial}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: fonts.name, fontWeight: 600 }}>
                {loc.display_name}
              </div>
              {loc.address && (
                <div
                  style={{
                    fontSize: fonts.sub,
                    color: themeUse.fgMuted,
                    marginTop: 4,
                  }}
                >
                  {loc.address}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              fontSize: fonts.footer,
              color: themeUse.fgMuted,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 22,
                borderRadius: 4,
                background: themeUse.logoBg,
                color: themeUse.logoColor(brand),
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              B
            </span>
            BAAM Review
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
