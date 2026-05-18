import type { Metadata } from "next";
import { readMarketingDoc } from "@/lib/marketing/render";
import { MarketingZhScripts } from "@/components/marketing/marketing-zh-scripts";

export const metadata: Metadata = {
  title: "BAAM Review — 把满意顾客变成评价、推荐与营收",
  description:
    "本地商家的「评价营收引擎」。60 秒收集 Google 评价，展示在您的网站，分发到小红书与社交平台，把满意顾客变成推荐与营收。",
};

// Real Next route serving the approved Chinese marketing prototype
// (Approach B): pixel-for-pixel HTML+CSS from public/baam-review-zh.html,
// original <script> re-implemented as a typed client component. The root
// layout only loads Latin fonts via next/font, so the prototype's own
// Google Fonts <link> (Noto Serif/Sans SC + Fraunces) is rendered here.
export default function MarketingZhPage() {
  const { css, bodyHtml } = readMarketingDoc("baam-review-zh.html");
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700;900&family=Noto+Sans+SC:wght@300;400;500;700&family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1&display=swap"
      />
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
      <MarketingZhScripts />
    </>
  );
}
