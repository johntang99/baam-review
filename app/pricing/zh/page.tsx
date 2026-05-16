import type { Metadata } from "next";
import { readMarketingDoc } from "@/lib/marketing/render";
import { MarketingScripts } from "@/components/marketing/marketing-scripts";

export const metadata: Metadata = {
  title: "定价 — BAAM Review",
  description:
    "BAAM Review 透明定价。自助使用 $89/月起。全方位服务 $299/月起。前 50 位自助用户和前 20 位全方位服务用户享创始客户终身锁定价。",
};

export default function PricingZhPage() {
  const { css, bodyHtml } = readMarketingDoc("marketing-pricing-zh.html");
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
