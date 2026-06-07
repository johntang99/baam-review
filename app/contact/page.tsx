import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { readMarketingDoc } from "@/lib/marketing/render";
import { AskQuestionModal } from "@/components/marketing/ask-question-modal";
import { ContactFormHandler } from "@/components/marketing/contact-form-handler";

export const metadata: Metadata = {
  title: "Contact — BAAM Review",
  description:
    "Get in touch with the BAAM Review team. Real humans reply within one business day.",
};

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const { css, bodyHtml } = readMarketingDoc("marketing-contact.html");
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
      <ContactFormHandler />
      <AskQuestionModal />
    </>
  );
}

function renderSignedInCluster(): string {
  return `
    <a href="/audit/list" class="nav-cta-signin" title="My audits" aria-label="My audits" style="display:inline-flex;align-items:center;color:var(--text-soft);font-size:14px;">My audits</a>
    <form action="/api/auth/signout" method="post" style="margin:0;">
      <input type="hidden" name="next" value="/contact">
      <button type="submit" style="background:none;border:none;padding:0;margin:0;font-family:inherit;font-size:14px;color:var(--text-soft);cursor:pointer;line-height:1;">Sign out</button>
    </form>
  `;
}
