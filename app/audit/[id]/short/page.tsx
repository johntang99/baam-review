import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveAuditViewer, canViewAudit } from "@/lib/audit/audit-access";
import { auditIdFilter, shortAuditId } from "@/lib/audit/audit-id";
import {
  SHORT_REPORT_STYLES,
  ShortReportBody,
  buildShortReportModel,
  type AuditShortRow,
} from "@/lib/audit/short-report";

export const metadata = { title: "Short Version — BAAM Review Audit" };
export const dynamic = "force-dynamic";

export default async function AuditShortVersionPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await props.params;
  const params = await props.searchParams;
  const language = params.lang === "zh" ? "zh" : "en";

  const idFilter = auditIdFilter(id);
  if (!idFilter) notFound();

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
    if (!viewer.viewerId) redirect(`/login?next=/audit/${id}/short`);
    notFound();
  }

  const model = await buildShortReportModel(data, language);
  const otherLang = language === "en" ? "zh" : "en";
  const langToggleLabel = otherLang === "zh" ? "中文" : "EN";
  const topbar = {
    backHref: `/audit/${id}?lang=${language}`,
    backLabel: model.ui.back,
    auditIdLabel: shortAuditId(data.id),
    langToggleHref: `/audit/${id}/short?lang=${otherLang}`,
    langToggleLabel,
    htmlDownloadHref: `/audit/${id}/short/download?format=html&lang=${language}`,
    pdfDownloadHref: `/audit/${id}/short/download?format=pdf&lang=${language}`,
  };

  return (
    <>
      <style>{SHORT_REPORT_STYLES}</style>
      <ShortReportBody model={model} topbar={topbar} />
    </>
  );
}
