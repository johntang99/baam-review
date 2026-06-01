import Link from "next/link";
import { Download } from "lucide-react";

interface AuditResultSubBarProps {
  audit_id: string;
  business_name: string;
  short_id?: string;
  city?: string;
  state?: string;
  score?: number;
  grade?: string;
  pdf_urls: Record<string, string>;
  languages_rendered: string[];
  current_language: "en" | "zh";
}

/** Contextual sub-bar that sits under the primary AuditTopNav on the
 *  /audit/[id] result page. Carries audit-specific chrome that doesn't
 *  belong in the global nav. */
export function AuditResultSubBar({
  audit_id,
  business_name,
  short_id,
  city,
  state,
  score,
  grade,
  pdf_urls,
  languages_rendered,
  current_language,
}: AuditResultSubBarProps) {
  const enUrl = pdf_urls.en;
  const zhUrl = pdf_urls.zh;
  const hasBilingual =
    languages_rendered.includes("en") && languages_rendered.includes("zh");
  const otherLang = current_language === "en" ? "zh" : "en";

  const metaParts: string[] = [];
  if (city) metaParts.push(city.toUpperCase());
  if (state) metaParts.push(state.toUpperCase());
  if (short_id) metaParts.push(short_id);
  if (score != null && grade) metaParts.push(`SCORE ${score}/${grade}`);
  const metaLine = metaParts.join(" · ");

  return (
    <div className="audit-subbar">
      <div className="audit-subbar-inner">
        <div className="audit-subbar-left">
          <Link href="/audits" className="audit-subbar-back">
            ← My audits
          </Link>
          <div className="audit-subbar-context">
            <div className="audit-subbar-business">{business_name}</div>
            {metaLine && <div className="audit-subbar-meta">{metaLine}</div>}
          </div>
        </div>

        <div className="audit-subbar-right">
        {hasBilingual && (
          <Link
            href={`/audit/${audit_id}?lang=${otherLang}`}
            className="audit-subbar-lang-toggle"
          >
            {otherLang === "zh" ? "中文" : "EN"}
          </Link>
        )}
        {enUrl && (
          <a
            href={enUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="audit-subbar-pdf-btn"
          >
            <Download className="h-3 w-3 opacity-60" />
            EN PDF
          </a>
        )}
        {zhUrl && (
          <a
            href={zhUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="audit-subbar-pdf-btn"
          >
            <Download className="h-3 w-3 opacity-60" />
            中文 PDF
          </a>
        )}
        <Link href="/audit/new" className="audit-subbar-new-btn">
          New audit
        </Link>
        </div>
      </div>
    </div>
  );
}
