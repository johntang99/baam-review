import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Share card image for the post-review "Refer a friend" flow.
 *
 * Path: /og/share/<request_id>
 *
 * Only renders content when the underlying review_requests row has
 * consent_display=true. Otherwise returns a neutral branded card so the link
 * remains useful but no review-sourced wording is republished without consent.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  const supabase = createServiceClient();
  const { data: req } = await supabase
    .from("review_requests")
    .select(
      "id, recipient_name, consent_display, location_id, completed_platform",
    )
    .eq("id", token)
    .maybeSingle();

  let locationId = req?.location_id ?? null;
  let consent = !!req?.consent_display;
  let recipientFirstName: string | null = null;
  if (req?.recipient_name) {
    recipientFirstName = req.recipient_name.trim().split(/\s+/)[0] ?? null;
  }

  if (!locationId) {
    return new Response("Not found", { status: 404 });
  }

  const { data: loc } = await supabase
    .from("locations")
    .select("display_name, address, brand_color, slug")
    .eq("id", locationId)
    .maybeSingle();
  if (!loc) return new Response("Not found", { status: 404 });

  const accent = loc.brand_color ?? "#1F4D3F";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://review.baamplatform.com";
  const ctaUrl = `${baseUrl}/r/${loc.slug}`;

  const quote = consent
    ? recipientFirstName
      ? `${recipientFirstName} just recommended ${loc.display_name}.`
      : `A happy customer just recommended ${loc.display_name}.`
    : `Discover ${loc.display_name}.`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(160deg, ${accent} 0%, ${darken(accent, 0.25)} 100%)`,
          color: "white",
          padding: 64,
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div
            style={{
              padding: "6px 14px",
              background: "rgba(255,255,255,0.18)",
              borderRadius: 999,
              fontSize: 18,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            ★ Recommended by a customer
          </div>
        </div>

        <div style={{ display: "flex", color: "#FFD56A", fontSize: 56, letterSpacing: 8 }}>
          ★★★★★
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 60,
            lineHeight: 1.15,
            fontStyle: "italic",
            fontWeight: 400,
            maxWidth: 1000,
          }}
        >
          “{quote}”
        </div>

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.22)",
            paddingTop: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 14,
                background: "white",
                color: accent,
                fontSize: 40,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {loc.display_name.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 30, fontWeight: 600 }}>{loc.display_name}</div>
              <div style={{ fontSize: 20, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
                {loc.address ?? ctaUrl}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.8)" }}>
            {ctaUrl}
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}

// Small darken helper. Hex only ("#RRGGBB"). For anything else we fall back to the input.
function darken(hex: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.floor((num & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
