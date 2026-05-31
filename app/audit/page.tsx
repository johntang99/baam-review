import type { Metadata } from "next";
import { readMarketingDoc } from "@/lib/marketing/render";

export const metadata: Metadata = {
  title: "BAAM Review Audit — Free reputation report for local businesses",
  description:
    "A 7-page reputation audit for your local business. Score, projection, competitor comparison, 12-month action plan. Free, no credit card.",
};

export default function AuditMarketingPage() {
  const { css, bodyHtml } = readMarketingDoc("audit-marketing.html");
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
