import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildQrPoster } from "@/lib/pdf/qr-poster";
import { isLanguage, type Language } from "@/lib/i18n/review";

const INSTRUCTION_BY_LANG: Record<Language, string> = {
  en: "Scan to leave a review",
  zh: "Scan to leave a review", // Helvetica can't render CJK
  es: "Escanee para dejar una reseña",
};

const VENUE_LABEL: Record<string, string> = {
  front_desk: "Front desk",
  receipt: "Receipt",
  business_card: "Business card",
  table_tent: "Table tent",
  window: "Window decal",
};

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const url = request.nextUrl;
  const source = url.searchParams.get("source");
  const langParam = url.searchParams.get("lang");
  const venueLabelRaw = url.searchParams.get("venue_label");

  const supabase = createServiceClient();
  const { data: location } = await supabase
    .from("locations")
    .select("display_name, supported_languages, default_language")
    .eq("slug", slug)
    .maybeSingle();

  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://review.baamplatform.com";

  // Build the destination URL with optional source and lang.
  const target = new URL(`${appUrl}/r/${slug}`);
  if (source) target.searchParams.set("source", source);
  if (isLanguage(langParam) && location.supported_languages.includes(langParam)) {
    target.searchParams.set("lang", langParam);
  }

  const lang: Language = isLanguage(langParam) ? langParam : "en";

  // Secondary instructions in other supported languages (Latin-only renders).
  const otherLangs = location.supported_languages
    .filter((l) => l !== lang)
    .filter(isLanguage);
  const secondaryInstructions = otherLangs
    .map((l) => INSTRUCTION_BY_LANG[l])
    .filter((s) => s && s !== INSTRUCTION_BY_LANG[lang]);

  const venueLabel = venueLabelRaw
    ? venueLabelRaw
    : source && VENUE_LABEL[source]
      ? VENUE_LABEL[source]
      : null;

  const pdfBytes = await buildQrPoster({
    businessName: location.display_name,
    url: target.toString(),
    instruction: INSTRUCTION_BY_LANG[lang],
    secondaryInstructions,
    venueLabel: venueLabel ?? undefined,
  });

  const filenameBase = `${slug}${source ? `-${source}` : ""}`;
  // The Uint8Array from pdf-lib is what Response expects directly.
  return new Response(pdfBytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
