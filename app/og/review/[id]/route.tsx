import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/service";
import { pickComment } from "@/components/widget/review-card";
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

  // Strip Google's "(Translated by Google) ... (Original) ..." wrapper so the
  // card shows ONE version, not both concatenated. Default to the translated
  // (English) variant for broadest social-share audience; ?lang=zh|es flips
  // the preference per pickComment's rules.
  const langParam = url.searchParams.get("lang");
  const preferLang =
    langParam === "zh" || langParam === "es" || langParam === "en"
      ? langParam
      : "en";
  const commentOne = pickComment(review.comment, preferLang, "translated") ?? "";

  // Tighter character budget — needs to fit ~4 visible lines at the chosen
  // font size given the card's padding and the bottom attribution + footer
  // rows. CJK characters are wider; if the picked variant looks CJK, shrink
  // further.
  const isCJK = /[　-鿿぀-ヿ가-힯]/.test(commentOne);
  const baseLen = size === "og" ? 220 : size === "square" ? 180 : 160;
  const maxLen = isCJK ? Math.floor(baseLen * 0.45) : baseLen;
  const quote = commentOne.trim();
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
            <StarSvg size={fonts.mark} color={accent} />
            Recommended by a customer
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: Math.max(6, Math.floor(fonts.stars / 8)),
          }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <StarSvg
              key={i}
              size={fonts.stars}
              color={i < Math.max(1, Math.min(5, review.rating)) ? accent : "rgba(255,255,255,0.2)"}
            />
          ))}
        </div>

        <div
          style={{
            display: "-webkit-box",
            marginTop: 36,
            fontSize: fonts.quote,
            lineHeight: 1.15,
            fontStyle: "italic",
            fontWeight: 400,
            maxWidth: size === "story" ? 920 : 1000,
            overflow: "hidden",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
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

/**
 * Inline star glyph. next/og's default font doesn't include the Black Star
 * Unicode codepoint (U+2605), so emitting "★" as text renders as a tofu box
 * on the server. SVG renders identically regardless of font availability.
 */
function StarSvg({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <path
        d="M12 2.5 14.95 8.48 21.55 9.44 16.78 14.09 17.9 20.66 12 17.56 6.1 20.66 7.22 14.09 2.45 9.44 9.05 8.48Z"
        fill={color}
      />
    </svg>
  );
}
