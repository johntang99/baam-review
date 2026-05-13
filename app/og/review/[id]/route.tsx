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
      "id, google_review_id, reviewer_display_name, reviewer_profile_photo_url, rating, comment, review_create_time, location_id",
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

  const quote = commentOne.trim();
  const isCJK = /[　-鿿぀-ヿ가-힯]/.test(quote);
  // CJK chars are visually ~2× wider, so they consume more line-budget per
  // character. We feed an "effective length" to the font-size picker.
  const effectiveLen = isCJK ? quote.length * 2 : quote.length;

  // Per-size font sizes (everything except quote which auto-scales below).
  const fonts = size === "og"
    ? { mark: 18, stars: 56, attr: 22, name: 28, sub: 18, footer: 16 }
    : size === "square"
      ? { mark: 18, stars: 60, attr: 22, name: 30, sub: 18, footer: 16 }
      : { mark: 20, stars: 72, attr: 26, name: 32, sub: 20, footer: 18 };

  // Auto-scale the quote font so the full review fits. We keep the card at
  // its target aspect ratio (Facebook/Instagram require fixed dims) and
  // shrink type instead of truncating mid-sentence.
  const quoteFontSize = pickQuoteFontSize(size, effectiveLen);

  const padding = size === "story" ? 80 : 64;

  try {
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
            display: "flex",
            marginTop: 36,
            fontSize: quoteFontSize,
            lineHeight: 1.18,
            fontStyle: "italic",
            fontWeight: 400,
            maxWidth: size === "story" ? 920 : 1000,
            // No truncation — the font shrinks via pickQuoteFontSize() until
            // the entire review fits in the available vertical space.
          }}
        >
          “{quote}”
        </div>

        <div style={{ flex: 1 }} />

        {review.reviewer_display_name && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: fonts.attr,
              color: themeUse.fgMuted,
              marginBottom: 28,
            }}
          >
            {isSafeGooglePhotoUrl(review.reviewer_profile_photo_url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={review.reviewer_profile_photo_url!}
                width={fonts.attr * 3.8}
                height={fonts.attr * 3.8}
                alt=""
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `3px solid ${themeUse.key === "quiet-cream" ? "rgba(15,31,26,0.12)" : "rgba(255,255,255,0.25)"}`,
                }}
              />
            )}
            <span style={{ display: "flex" }}>
              — {review.reviewer_display_name}, satisfied customer
            </span>
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
        // Allow cross-origin fetch so customer sites + the admin running on
        // localhost can download the PNG via JS without CORS preflight pain.
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
  } catch (err) {
    console.error("og/review render failed", {
      googleReviewId: review.google_review_id,
      size,
      theme: themeUse.key,
      error: err instanceof Error ? err.message : String(err),
    });
    // Fall back to a minimal solid-color image so the share builder doesn't
    // show a broken-image icon. Same dimensions as the requested size.
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: bg,
            color: themeUse.fg,
            fontSize: 40,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {loc.display_name}
        </div>
      ),
      {
        width,
        height,
        headers: {
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

/**
 * Pick a quote font size that fits the full review within the card's
 * available vertical space. The buckets were calibrated empirically against
 * each card aspect — short reviews stay large for impact; long reviews
 * shrink so nothing gets clipped.
 *
 * effectiveLen treats CJK characters as 2× wide (already applied at call site).
 */
function pickQuoteFontSize(
  size: "og" | "square" | "story",
  effectiveLen: number,
): number {
  // Buckets calibrated against actual rendered output, not theoretical
  // character widths. Goal: fill ~70–85% of the available quote area
  // vertically, so short reviews are punchy and long reviews still feel
  // like a deliberate composition rather than a wall of text.
  const buckets: Record<typeof size, { max: number; fs: number }[]> = {
    // OG card 1200×630 — wide but short. Quote area roughly 1072×320.
    og: [
      { max: 80, fs: 50 },
      { max: 160, fs: 40 },
      { max: 280, fs: 30 },
      { max: 450, fs: 24 },
      { max: 700, fs: 20 },
      { max: 1000, fs: 17 },
      { max: Infinity, fs: 15 },
    ],
    // Square 1080×1080 — generous middle band, roughly 952×650 for quote.
    square: [
      { max: 80, fs: 64 },
      { max: 180, fs: 56 },
      { max: 320, fs: 46 },
      { max: 500, fs: 38 },
      { max: 750, fs: 32 },
      { max: 1100, fs: 27 },
      { max: 1600, fs: 22 },
      { max: Infinity, fs: 18 },
    ],
    // Story 1080×1920 — lots of vertical space, can stay bigger much longer.
    story: [
      { max: 100, fs: 84 },
      { max: 200, fs: 72 },
      { max: 400, fs: 58 },
      { max: 650, fs: 48 },
      { max: 1000, fs: 40 },
      { max: 1500, fs: 32 },
      { max: 2200, fs: 26 },
      { max: Infinity, fs: 22 },
    ],
  };
  const list = buckets[size];
  for (const b of list) {
    if (effectiveLen <= b.max) return b.fs;
  }
  return list[list.length - 1].fs;
}

/**
 * Inline star glyph. next/og's default font doesn't include the Black Star
 * Unicode codepoint (U+2605), so emitting "★" as text renders as a tofu box
 * on the server. SVG renders identically regardless of font availability.
 */
/**
 * Validate Google-hosted profile photo URLs before fetching them via Satori.
 * Restricts to known Google hostnames so a malicious or stale value can't
 * coerce the server into fetching an arbitrary remote URL.
 */
function isSafeGooglePhotoUrl(u: string | null | undefined): u is string {
  if (!u) return false;
  try {
    const url = new URL(u);
    return (
      url.protocol === "https:" &&
      (url.hostname.endsWith(".googleusercontent.com") ||
        url.hostname.endsWith(".googleapis.com") ||
        url.hostname === "lh3.google.com")
    );
  } catch {
    return false;
  }
}

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
