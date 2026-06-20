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
  /** Kept for backward compatibility — the pre-baked PDF URLs stored on
   *  the audit row at generation time. We no longer link to these
   *  because they go stale every time we update the template. Downloads
   *  go through /audit/[id]/download which re-renders from the current
   *  template. Prop is still consumed in the type so callers don't
   *  break, but it's intentionally unused. */
  pdf_urls?: Record<string, string>;
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
  languages_rendered,
  current_language,
}: AuditResultSubBarProps) {
  const hasBilingual =
    languages_rendered.includes("en") && languages_rendered.includes("zh");
  const otherLang = current_language === "en" ? "zh" : "en";
  // Download URLs always render fresh from the current template; ?lang
  // controls the language variant. Format selector ?format=html|pdf is
  // the only difference between the two buttons.
  const downloadHref = (format: "html" | "pdf", lang: "en" | "zh") =>
    `/audit/${audit_id}/download?format=${format}&lang=${lang}`;
  const langLabel = current_language === "zh" ? "中文" : "EN";

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
          <Link href="/audit/list" className="audit-subbar-back">
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
        <a
          href={downloadHref("html", current_language)}
          className="audit-subbar-pdf-btn"
        >
          <Download className="h-3 w-3 opacity-60" />
          {langLabel} HTML
        </a>
        <Link
          href={`/audit/${audit_id}/short?lang=${current_language}`}
          className="audit-subbar-pdf-btn"
        >
          Short Version
        </Link>
        <a
          href={downloadHref("pdf", current_language)}
          className="audit-subbar-pdf-btn"
        >
          <Download className="h-3 w-3 opacity-60" />
          {langLabel} PDF
        </a>
        <Link href="/audit/new" className="audit-subbar-new-btn">
          New audit
        </Link>
        </div>
      </div>
    </div>
  );
}
