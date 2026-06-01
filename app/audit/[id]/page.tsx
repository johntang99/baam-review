import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuditTopNav } from "@/components/audit/audit-top-nav";
import { AuditResultSubBar } from "@/components/audit/audit-result-subbar";
import { AuditEmbed } from "./audit-embed";

export const metadata = { title: "Your audit — BAAM Review Audit" };
export const dynamic = "force-dynamic";

interface AuditRow {
  id: string;
  user_id: string | null;
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

function shortAuditId(id: string): string {
  return `BR-${id.slice(0, 4)}-${id.slice(4, 8)}`.toUpperCase();
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
  if (!authData.user) {
    redirect(`/login?next=/audit/${id}`);
  }

  const { data, error } = await supabase
    .from("audits")
    .select(
      "id,user_id,tier,total_score,grade,languages_rendered,pdf_urls,generated_at,google_data",
    )
    .eq("id", id)
    .maybeSingle<AuditRow>();

  if (error || !data) notFound();

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
