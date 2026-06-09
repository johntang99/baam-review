import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuditTopNav } from "@/components/audit/audit-top-nav";
import { AuditResultSubBar } from "@/components/audit/audit-result-subbar";
import { auditIdFilter, shortAuditId } from "@/lib/audit/audit-id";
import { AuditEmbed } from "./audit-embed";

export const metadata = { title: "Your audit — BAAM Review Audit" };
export const dynamic = "force-dynamic";

interface AuditRow {
  id: string;
  user_id: string | null;
  is_public: boolean;
  tier: string;
  total_score: number;
  grade: string;
  languages_rendered: string[];
  pdf_urls: Record<string, string>;
  generated_at: string;
  google_data: {
    business: {
      name: string;
      formatted_address: string;
      city: string;
      state: string;
    };
    language: { is_chinese_business: boolean };
  };
}

export default async function AuditResultPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await props.params;
  const params = await props.searchParams;
  const lang = params.lang === "zh" ? "zh" : "en";

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  // Fetch first — RLS lets anonymous visitors read the row when
  // is_public=true via the audits_select_public policy. If the row comes
  // back, the visitor is either the owner, BAAM staff, or anyone holding
  // the link to a public audit; either case may proceed. If the row is
  // null AND the visitor isn't signed in, send them to login so they have
  // a chance to authenticate before we 404.
  const idFilter = auditIdFilter(id);
  if (!idFilter) notFound();

  let query = supabase
    .from("audits")
    .select(
      "id,user_id,is_public,tier,total_score,grade,languages_rendered,pdf_urls,generated_at,google_data",
    );
  query =
    "exact" in idFilter
      ? query.eq("id", idFilter.exact)
      : query.gte("id", idFilter.lo).lte("id", idFilter.hi).limit(1);

  const { data, error } = await query.maybeSingle<AuditRow>();

  if (error || !data) {
    if (!authData.user) redirect(`/login?next=/audit/${id}`);
    notFound();
  }

  const business = data.google_data.business;

  return (
    <main className="min-h-screen bg-cream">
      <AuditTopNav />
      <AuditResultSubBar
        audit_id={data.id}
        business_name={business.name}
        short_id={shortAuditId(data.id)}
        city={business.city}
        state={business.state}
        score={data.total_score}
        grade={data.grade}
        pdf_urls={data.pdf_urls}
        languages_rendered={data.languages_rendered}
        current_language={lang}
      />
      <AuditEmbed src={`/audit/${id}/embed?lang=${lang}`} />
    </main>
  );
}
