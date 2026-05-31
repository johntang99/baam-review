import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
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
    business: { name: string; formatted_address: string };
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
  const enUrl = data.pdf_urls.en;
  const zhUrl = data.pdf_urls.zh;
  const hasBilingual = !!enUrl && !!zhUrl;
  const otherLang = lang === "en" ? "zh" : "en";

  return (
    <main className="min-h-screen bg-cream">
      <header className="sticky top-0 z-10 border-b border-border-base bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center gap-4">
          <Link href="/audits" className="text-text-soft hover:text-text text-sm shrink-0">
            ← My audits
          </Link>

          <div className="hidden md:block flex-1 min-w-0">
            <div className="text-sm font-medium text-text truncate">{business.name}</div>
            <div className="text-[11px] text-text-muted truncate">
              {business.formatted_address} · score {data.total_score}/{data.grade}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {hasBilingual && (
              <Link
                href={`/audit/${id}?lang=${otherLang}`}
                className="text-xs uppercase tracking-wider text-text-soft hover:text-text px-2 py-1"
              >
                {otherLang === "zh" ? "中文" : "EN"}
              </Link>
            )}
            {enUrl && (
              <a href={enUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm">
                  <Download className="h-3.5 w-3.5" />
                  EN PDF
                </Button>
              </a>
            )}
            {zhUrl && (
              <a href={zhUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm">
                  <Download className="h-3.5 w-3.5" />
                  中文 PDF
                </Button>
              </a>
            )}
            <Link href="/audit/new">
              <Button variant="primary" size="sm">New audit</Button>
            </Link>
          </div>
        </div>
      </header>

      <AuditEmbed src={`/audit/${id}/embed?lang=${lang}`} />
    </main>
  );
}
