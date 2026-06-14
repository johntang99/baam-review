import type { Metadata } from "next";
import { readMarketingDoc } from "@/lib/marketing/render";

export const metadata: Metadata = {
  title: "口碑诊断报告样本 · Sample Review Audit — BAAM Review",
  description:
    "A sample BAAM Review audit report — the 7-page reputation diagnostic prospects receive. Linked from the marketing pages' “view a sample report” CTA.",
};

// Serves the static sample audit report (public/audit-sample.html) at
// /audit/sample — the target of the "查看诊断报告样本 / view a sample report"
// CTA on the marketing pages. Same Approach-B pattern as the other marketing
// docs: the prototype's <style> (which includes its self-hosted @font-face
// rules) and <body> are rendered inline. The doc has no <script>.
export default function AuditSamplePage() {
  const { css, bodyHtml } = readMarketingDoc("audit-sample.html");
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </>
  );
}
