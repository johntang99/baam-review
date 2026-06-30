import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveAuditViewer, canViewAudit } from "@/lib/audit/audit-access";
import { auditIdFilter, shortAuditId } from "@/lib/audit/audit-id";
import {
  SHORT_REPORT_STYLES,
  buildShortReportModel,
  type AuditShortRow,
  type ShortReportLanguage,
  type ShortReportModel,
} from "@/lib/audit/short-report";
import { renderHtmlToPdf } from "@/lib/audit/templating/pdf-renderer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "html";
  const language: ShortReportLanguage = url.searchParams.get("lang") === "zh" ? "zh" : "en";

  const idFilter = auditIdFilter(id);
  if (!idFilter) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const viewer = await resolveAuditViewer(supabase);
  const service = createServiceClient();
  let query = service
    .from("audits")
    .select(
      "id,user_id,is_public,tier,vertical,region,generated_at,google_data,competitors_data,score_data,platforms_data",
    );
  query =
    "exact" in idFilter
      ? query.eq("id", idFilter.exact)
      : query.gte("id", idFilter.lo).lte("id", idFilter.hi).limit(1);

  const { data, error } = await query.maybeSingle<AuditShortRow>();
  if (error || !data || !canViewAudit(data, viewer)) {
    if (!viewer.viewerId) return new NextResponse("Unauthorized", { status: 401 });
    return new NextResponse("Not found", { status: 404 });
  }

  const model = await buildShortReportModel(data, language);
  const bodyHtml = renderShortReportBodyHtml(model);
  const fontBase =
    process.env.AUDIT_FONT_BASE ??
    (process.env.NODE_ENV === "production"
      ? (process.env.NEXT_PUBLIC_APP_URL ?? "https://baamreview.com")
      : "http://localhost:4001");
  const shortReportStyles = SHORT_REPORT_STYLES.replace(/__FONT_BASE__/g, fontBase);
  const fullHtml = [
    "<!doctype html>",
    `<html lang="${language}">`,
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    "<title>BAAM Short Report</title>",
    `<style>${shortReportStyles}</style>`,
    "</head>",
    "<body>",
    bodyHtml,
    "</body>",
    "</html>",
  ].join("");

  const slug = slugify(model.businessName);
  const baseFilename = `baam-short-report-${slug}-${shortAuditId(data.id)}-${language}`;

  if (format === "pdf") {
    const pdf = await renderHtmlToPdf(fullHtml);
    return new NextResponse(new Uint8Array(pdf.pdf_buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseFilename}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return new NextResponse(fullHtml, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseFilename}.html"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "audit";
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderShortReportBodyHtml(model: ShortReportModel): string {
  const ui = model.ui;

  const metricsHtml = model.metrics
    .map(
      (metric) => `
        <div class="metric">
          <div class="label">${escapeHtml(metric.label)}</div>
          <div class="bar"><i style="width:${Math.max(0, Math.min(100, metric.fillPct))}%"></i></div>
          <div class="num">${metric.score}</div>
        </div>`,
    )
    .join("");

  const gradeRowsHtml = model.gradeLadder
    .map((row) => {
      const isCurrent = row.grade === model.grade;
      return `
        <tr${isCurrent ? ' class="you-grade"' : ""}>
          <td class="mono">${escapeHtml(row.range)}</td>
          <td>
            <span class="grade-letter-pill">${escapeHtml(row.grade)}</span>
            ${isCurrent ? `<span class="you-tag">${escapeHtml(ui.yourBusinessTag)}</span>` : ""}
          </td>
          <td>${escapeHtml(row.meaning)}</td>
        </tr>`;
    })
    .join("");

  const competitorRowsHtml = model.competitorRows
    .map((row) => {
      const businessMeta = [row.addressLine, row.distanceDisplay]
        .filter((v) => typeof v === "string" && v.trim().length > 0)
        .join(" · ");
      return `
        <tr${row.isYou ? ' class="you-grade"' : ""}>
          <td class="mono">${row.rank}</td>
          <td class="mini-business-cell">
            <div class="mini-business-row-top">
              <div class="mini-business-name">${escapeHtml(row.name)}${row.isYou ? ` <span class="you-tag">${escapeHtml(ui.yourRowTag)}</span>` : ""}</div>
              ${row.websiteDisplay ? `<span class="mini-business-website">${escapeHtml(row.websiteDisplay)}</span>` : ""}
            </div>
            ${businessMeta ? `<div class="mini-business-meta">${escapeHtml(businessMeta)}</div>` : ""}
          </td>
          <td class="mono">${row.score}</td>
          <td class="mono">${escapeHtml(row.rating)} · ${row.total}</td>
          <td class="mono">${escapeHtml(String(row.last30d))}</td>
        </tr>`;
    })
    .join("");

  const actionsHtml = model.actions
    .map((title) => `<li>${escapeHtml(title)}</li>`)
    .join("");

  const gradeMeaning =
    model.gradeLadder.find((row) => row.grade === model.grade)?.meaning ?? "";
  const businessAddressLine = [model.businessAddressLine1, model.businessAddressLine2]
    .filter((v) => v && v.trim().length > 0)
    .join(" · ");
  const businessMetaHtml = [
    businessAddressLine
      ? `<p class="line address">${escapeHtml(businessAddressLine)}</p>`
      : "",
    model.businessWebsiteLine
      ? `<p class="line website">${escapeHtml(model.businessWebsiteLine)}</p>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <main class="short-letter-root">
      <section class="short-letter-page page">
        <div class="short-letter-kicker">${escapeHtml(ui.kicker)}</div>
        <h1 class="short-letter-title">${escapeHtml(model.businessName)}</h1>
        ${businessMetaHtml ? `<div class="short-letter-business-meta">${businessMetaHtml}</div>` : ""}
        <p class="short-letter-subtitle">${escapeHtml(ui.sentenceA)}</p>
        <p class="short-letter-subtitle soft">${escapeHtml(ui.sentenceB)}</p>

        <div class="short-letter-card">
          <h2 class="score-title">${escapeHtml(ui.scoreTitle)}</h2>
          <div class="score-row">
            <div class="score-big">${model.score}<span>/100</span></div>
            <div class="grade-box">
              <div class="grade-letter">${escapeHtml(model.grade)}</div>
              <div class="grade-copy">${escapeHtml(gradeMeaning)}</div>
            </div>
          </div>
          ${metricsHtml}
        </div>

        <p class="section-title">${escapeHtml(ui.gradeTableTitle)}</p>
        <p class="grade-note">${escapeHtml(ui.gradeNotePrefix)} <strong>${escapeHtml(model.grade)}</strong>${escapeHtml(ui.gradeNoteSuffix)}</p>
        <table class="grade-table">
          <thead>
            <tr>
              <th>${escapeHtml(ui.scoreRange)}</th>
              <th>${escapeHtml(ui.gradeCol)}</th>
              <th>${escapeHtml(ui.meaningCol)}</th>
            </tr>
          </thead>
          <tbody>
            ${gradeRowsHtml}
          </tbody>
        </table>
      </section>

      <section class="short-letter-page page page-2">
        <p class="section-title-strong">${escapeHtml(ui.competitorsTitle)} (${model.competitorRows.length} ${escapeHtml(ui.businessesWord)})</p>
        <table class="mini-table">
          <thead>
            <tr>
              <th>${escapeHtml(ui.rankCol)}</th>
              <th>${escapeHtml(ui.businessCol)}</th>
              <th>${escapeHtml(ui.scoreCol)}</th>
              <th>${escapeHtml(ui.ratingTotalCol)}</th>
              <th>${escapeHtml(ui.last30dCol)}</th>
            </tr>
          </thead>
          <tbody>
            ${competitorRowsHtml}
          </tbody>
        </table>

        <h2 class="action-headline">${escapeHtml(ui.actionsTitle)}</h2>
        <ol class="short-action-list">${actionsHtml}</ol>

        <p class="para">${escapeHtml(ui.plusLine)}</p>

        <div class="offer-layout">
          <div class="offer-block">
            <p>${escapeHtml(ui.trialLine)}</p>
            <p><strong>${escapeHtml(ui.ctaLine)}</strong></p>
            <p>${escapeHtml(ui.contactLine)}</p>
          </div>
          <div class="offer-notes-box"></div>
        </div>

        <div class="ps-block">
          <p class="ps-inline"><span class="ps-prefix">${escapeHtml(ui.ps)}</span>${escapeHtml(ui.psLine)}</p>
        </div>
      </section>
    </main>
  `;
}
