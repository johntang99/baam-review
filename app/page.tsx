import type { Metadata } from "next";
import { readMarketingDoc } from "@/lib/marketing/render";
import { MarketingScripts } from "@/components/marketing/marketing-scripts";

export const metadata: Metadata = {
  title:
    "BAAM Review — Turn happy customers into reviews, referrals, and revenue",
  description:
    "The Review-to-Revenue Engine for local businesses. Collect Google reviews in 60 seconds, display them on your website, distribute to Xiaohongshu and social, turn happy customers into referrals.",
};

// Real Next route serving the approved marketing prototype (Approach B):
// pixel-for-pixel HTML+CSS from public/marketing-home.html, original
// <script> re-implemented as a typed client component.
export default function HomePage() {
  const { css, bodyHtml } = readMarketingDoc("marketing-home.html");
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
      <MarketingScripts />
    </>
  );
}
