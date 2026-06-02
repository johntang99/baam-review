import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { readMarketingDoc } from "@/lib/marketing/render";
import { MarketingScripts } from "@/components/marketing/marketing-scripts";

export const metadata: Metadata = {
  title:
    "BAAM Review — Turn happy customers into reviews, referrals, and revenue",
  description:
    "The Review-to-Revenue Engine for local businesses. Collect Google reviews in 60 seconds, display them on your website, distribute to Xiaohongshu and social, turn happy customers into referrals.",
};

export const dynamic = "force-dynamic";

// Real Next route serving the approved marketing prototype. The static HTML
// has a hardcoded "Sign in" link in the nav; when the visitor IS signed in,
// we string-replace that fragment with a Dashboard + Sign out cluster so
// the marketing nav matches their auth state (consistent with /audit/* nav).
export default async function HomePage() {
  const { css, bodyHtml } = readMarketingDoc("marketing-home.html");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  // The static marketing nav has a `<div data-nav-auth-slot ...>` wrapping
  // the Sign-in icon. When the visitor is signed in, swap the slot's
  // inner content for a dashboard-linked icon + Sign out form-button.
  // Matching the opening tag with its attrs avoids depending on quote style.
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
      <MarketingScripts />
    </>
  );
}

function renderSignedInCluster(): string {
  // Inner contents only — the surrounding `<div data-nav-auth-slot>` is
  // already a flex container (display:flex, gap:10px, align:center).
  return `
    <a href="/audit/list" class="nav-auth-link" title="My audits" aria-label="My audits" style="display:inline-flex;align-items:center;color:var(--text-soft)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>
    </a>
    <form action="/api/auth/signout" method="post" style="margin:0;">
      <input type="hidden" name="next" value="/">
      <button type="submit" style="background:none;border:none;padding:0;margin:0;font-family:inherit;font-size:13.5px;color:var(--text-soft);cursor:pointer;line-height:1;">Sign out</button>
    </form>
  `;
}
