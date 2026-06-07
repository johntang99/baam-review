import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { readMarketingDoc } from "@/lib/marketing/render";
import { AskQuestionModal } from "@/components/marketing/ask-question-modal";

export const metadata: Metadata = {
  title: "About — BAAM Review",
  description:
    "BAAM Review builds the review-to-revenue engine local businesses deserve. From BAAM Studio.",
};

export const dynamic = "force-dynamic";

// Mirrors app/page.tsx — reads the approved marketing HTML, swaps the
// nav auth slot for a signed-in cluster when the visitor is logged in.
export default async function AboutPage() {
  const { css, bodyHtml } = readMarketingDoc("marketing-about.html");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  const AUTH_SLOT_RE =
    /(<div data-nav-auth-slot[^>]*>)[\s\S]*?(<\/div>)/;
  const finalHtml = user
    ? bodyHtml.replace(AUTH_SLOT_RE, `$1${renderSignedInCluster()}$2`)
    : bodyHtml;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: finalHtml }}
      />
      <AskQuestionModal />
    </>
  );
}

function renderSignedInCluster(): string {
  return `
    <a href="/audit/list" class="nav-cta-signin" title="My audits" aria-label="My audits" style="display:inline-flex;align-items:center;color:var(--text-soft);font-size:14px;">My audits</a>
    <form action="/api/auth/signout" method="post" style="margin:0;">
      <input type="hidden" name="next" value="/about">
      <button type="submit" style="background:none;border:none;padding:0;margin:0;font-family:inherit;font-size:14px;color:var(--text-soft);cursor:pointer;line-height:1;">Sign out</button>
    </form>
  `;
}
