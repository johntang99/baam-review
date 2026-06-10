import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditIdFilter, shortAuditId } from "@/lib/audit/audit-id";
import { getBenchmarks } from "@/lib/audit/benchmarks";
import { computeProjection } from "@/lib/audit/projection";
import {
  buildAuditViewModel,
  renderAuditHtml,
  renderAuditPdf,
  type RenderAuditInput,
} from "@/lib/audit/templating";
import type { AuditCompetitorsData } from "@/lib/audit/competitors/types";
import type { AuditGoogleData } from "@/lib/audit/google/types";
import type { AuditProjection } from "@/lib/audit/projection/types";
import type { AuditScore } from "@/lib/audit/scoring/types";
import type { RegionKey } from "@/lib/audit/benchmarks/types";
import type { AuditLanguage } from "@/lib/audit/templating/types";

/**
 * On-demand download of an audit report in either HTML or PDF.
 *
 *   GET /audit/<id>/download?format=html&lang=en
 *   GET /audit/<id>/download?format=pdf&lang=en
 *
 * Both formats are rendered fresh from the stored audit data using the
 * current template + data-mapper, NOT from the pre-baked `pdf_urls`
 * column on the audit row. That column holds the snapshot taken at
 * audit-generation time, which goes stale every time we tweak the
 * template — surfacing those URLs from the result subbar was the source
 * of "the PDF is still showing the old layout" reports. The HTML format
 * mirrors what the embed iframe displays at /audit/<id>; the PDF format
 * runs that same HTML through puppeteer-core + @sparticuz/chromium.
 *
 * Auth: same as the embed route — must be signed in. We don't gate on
 * ownership beyond that because audit rows are by default user-private
 * and the staff-shared `is_baam_internal` paths already see everything.
 */
interface AuditRow {
  id: string;
  tier: string;
  vertical: string;
  region: string;
  generated_at: string;
  languages_rendered: string[];
  google_data: AuditGoogleData;
  competitors_data: AuditCompetitorsData;
  score_data: AuditScore;
  projection_data: AuditProjection;
}

export const dynamic = "force-dynamic";
// PDF generation can take 10–20s on cold Chromium start; bump max so
// Vercel doesn't kill the function mid-render.
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "html";
  const langParam = url.searchParams.get("lang");

  // Same dual-mode auth as /audit/[id]: anonymous visitors can download
  // when the audit is is_public (allowed by RLS audits_select_public).
  // Auth fallback only kicks in when the row isn't visible, so private
  // audits still 401 for anon and 404 for signed-in non-owners.
  const idFilter = auditIdFilter(id);
  if (!idFilter) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const supabase = await createClient();
  let query = supabase
    .from("audits")
    .select(
      "id,tier,vertical,region,generated_at,languages_rendered,google_data,competitors_data,score_data,projection_data",
    );
  query =
    "exact" in idFilter
      ? query.eq("id", idFilter.exact)
      : query.gte("id", idFilter.lo).lte("id", idFilter.hi).limit(1);

  const { data, error } = await query.maybeSingle<AuditRow>();

  if (error || !data) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return new NextResponse("Unauthorized", { status: 401 });
    return new NextResponse("Not found", { status: 404 });
  }

  const language: AuditLanguage = pickLanguage(langParam, data.languages_rendered);
  const benchmarks = await getBenchmarks(
    data.vertical as Parameters<typeof getBenchmarks>[0],
    data.region as RegionKey,
  );

  // Same Yelp / platforms lazy-load as the embed route — keeps the
  // downloaded artifact identical to what the user sees inline.
  const { getAllPlatformsData } = await import("@/lib/audit/platforms");
  const platforms = await getAllPlatformsData(
    data.google_data,
    data.tier as "free" | "paid",
  ).catch(() => undefined);

  const input: RenderAuditInput = {
    google: data.google_data,
    competitors: data.competitors_data,
    score: data.score_data,
    // Recompute with the current forecast model (see embed route).
    projection: computeProjection(
      data.google_data,
      data.competitors_data,
      data.score_data,
      benchmarks,
    ),
    benchmarks,
    platforms,
    tier: data.tier as "free" | "paid",
    language,
    audit_id: data.id,
    prepared_at: new Date(data.generated_at),
  };

  const businessName =
    data.google_data.business?.name?.trim() ?? "audit";
  const slug = slugify(businessName);
  const baseFilename = `baam-review-audit-${slug}-${shortAuditId(data.id)}-${language}`;

  if (format === "pdf") {
    const { pdf_buffer } = await renderAuditPdf(input);
    return new NextResponse(new Uint8Array(pdf_buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseFilename}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  // HTML
  const view = buildAuditViewModel(input);
  const html = renderAuditHtml(view);
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseFilename}.html"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function pickLanguage(
  param: string | null,
  rendered: string[],
): AuditLanguage {
  if (param === "zh" || param === "en") return param;
  if (rendered.includes("en")) return "en";
  if (rendered.includes("zh")) return "zh";
  return "en";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "audit";
}
