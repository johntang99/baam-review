import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveAuditViewer, canViewAudit } from "@/lib/audit/audit-access";
import { auditIdFilter } from "@/lib/audit/audit-id";
import { getBenchmarks } from "@/lib/audit/benchmarks";
import { computeProjection } from "@/lib/audit/projection";
import {
  buildAuditViewModel,
  renderAuditHtml,
  type AuditViewModel,
  type RenderAuditInput,
} from "@/lib/audit/templating";
import type { AuditCompetitorsData } from "@/lib/audit/competitors/types";
import type { AuditGoogleData } from "@/lib/audit/google/types";
import type { AuditProjection } from "@/lib/audit/projection/types";
import type { AuditScore } from "@/lib/audit/scoring/types";
import type { RegionKey } from "@/lib/audit/benchmarks/types";
import type { AuditLanguage } from "@/lib/audit/templating/types";

export const runtime = "nodejs";
// A report view should be fast (cache reads + pure rendering). This is only a
// safety net so an unexpected slow path can't hit an aggressively low default
// and render the report iframe blank.
export const maxDuration = 30;

interface AuditEmbedRow {
  id: string;
  user_id: string | null;
  is_public: boolean | null;
  tier: string;
  vertical: string;
  region: string;
  generated_at: string;
  languages_rendered: string[];
  google_data: AuditGoogleData;
  competitors_data: AuditCompetitorsData;
  score_data: AuditScore;
  projection_data: AuditProjection;
  platforms_data: import("@/lib/audit/platforms/types").AuditPlatformsData | null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const langParam = url.searchParams.get("lang");

  const idFilter = auditIdFilter(id);
  if (!idFilter) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Fetch with the service client (RLS bypassed) and authorize via
  // canViewAudit: shared (is_public) audits open for anyone with the link
  // (clients), everything else only for the owner or an admin.
  const supabase = await createClient();
  const viewer = await resolveAuditViewer(supabase);
  const service = createServiceClient();
  let query = service
    .from("audits")
    .select(
      "id,user_id,is_public,tier,vertical,region,generated_at,languages_rendered,google_data,competitors_data,score_data,projection_data,platforms_data",
    );
  query =
    "exact" in idFilter
      ? query.eq("id", idFilter.exact)
      : query.gte("id", idFilter.lo).lte("id", idFilter.hi).limit(1);

  const { data, error } = await query.maybeSingle<AuditEmbedRow>();

  if (error || !data || !canViewAudit(data, viewer)) {
    if (!viewer.viewerId) return new NextResponse("Unauthorized", { status: 401 });
    return new NextResponse("Not found", { status: 404 });
  }

  const language: AuditLanguage = pickLanguage(langParam, data.languages_rendered);
  const benchmarks = await getBenchmarks(
    data.vertical as Parameters<typeof getBenchmarks>[0],
    data.region as RegionKey,
  );

  // Platforms (Yelp, etc.) are frozen onto the audit row at generation time,
  // so a view just reads them off the snapshot — no external dependency.
  // Older audits predate platforms_data; fall back to the cache (cacheOnly so a
  // view never triggers a live fetch — that's what rendered the report blank).
  let platforms = data.platforms_data ?? undefined;
  if (!platforms) {
    const { getAllPlatformsData } = await import("@/lib/audit/platforms");
    platforms = await getAllPlatformsData(
      data.google_data,
      data.tier as "free" | "paid",
      { cacheOnly: true },
    ).catch(() => undefined);
  }

  const input: RenderAuditInput = {
    google: data.google_data,
    competitors: data.competitors_data,
    score: data.score_data,
    // Recompute the forecast from the stored data with the current model
    // rather than trusting the snapshot stored at generation time — the
    // projection is a forward-looking model and should always reflect the
    // latest logic (the measured score stays a snapshot).
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

  const view: AuditViewModel = buildAuditViewModel(input);
  const html = renderAuditHtml(view);
  const htmlWithHeightReporter = injectHeightReporter(html);

  return new NextResponse(htmlWithHeightReporter, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Always render the latest copy/template changes for existing audits.
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

function injectHeightReporter(html: string): string {
  // Override min-height: 100vh on .page — the audit CSS sizes each page
  // to viewport height so PDF rendering paginates cleanly. In an inline
  // iframe that creates a runaway loop (iframe grows → pages grow →
  // iframe grows). For screen embedding we want pages to be content-
  // height so the iframe sizes to the natural total.
  const styleOverride = `
<style>
  .page { min-height: 0 !important; }
  body { background: transparent !important; }
  body::before { display: none !important; }
</style>
`;

  const script = `
<script>
(function() {
  var lastHeight = 0;
  function postHeight() {
    var h = document.documentElement.scrollHeight;
    if (h === lastHeight) return;
    lastHeight = h;
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'audit-embed-height', height: h }, '*');
    }
  }
  function ready() {
    postHeight();
    setTimeout(postHeight, 250);
    setTimeout(postHeight, 1500);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(ready);
  } else if (document.readyState === 'complete') {
    ready();
  } else {
    window.addEventListener('load', ready);
  }
})();
</script>
`;
  return html
    .replace("</head>", `${styleOverride}</head>`)
    .replace("</body>", `${script}</body>`);
}
