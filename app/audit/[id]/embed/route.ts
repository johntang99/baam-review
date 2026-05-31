import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBenchmarks } from "@/lib/audit/benchmarks";
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

interface AuditEmbedRow {
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const langParam = url.searchParams.get("lang");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { data, error } = await supabase
    .from("audits")
    .select(
      "id,tier,vertical,region,generated_at,languages_rendered,google_data,competitors_data,score_data,projection_data",
    )
    .eq("id", id)
    .maybeSingle<AuditEmbedRow>();

  if (error || !data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const language: AuditLanguage = pickLanguage(langParam, data.languages_rendered);
  const benchmarks = await getBenchmarks(
    data.vertical as Parameters<typeof getBenchmarks>[0],
    data.region as RegionKey,
  );

  // Lazy-load any cached platform data for this place (currently Yelp only).
  // Platforms aren't stored on the audits row; we re-read from
  // audit_platform_data cache to surface them inline at render time.
  const { getAllPlatformsData } = await import("@/lib/audit/platforms");
  const platforms = await getAllPlatformsData(
    data.google_data,
    data.tier as "free" | "paid",
  ).catch(() => undefined);

  const input: RenderAuditInput = {
    google: data.google_data,
    competitors: data.competitors_data,
    score: data.score_data,
    projection: data.projection_data,
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
      "Cache-Control": "private, max-age=600",
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
