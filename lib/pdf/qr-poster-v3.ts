import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderHtmlToPdf } from "@/lib/audit/templating/pdf-renderer";
import { generateQrDataUrl } from "@/lib/qr";
import type { Language } from "@/lib/i18n/review";

export interface QrPosterV3Opts {
  businessName: string;
  url: string;
  language: "en" | "zh";
  venueLabel?: string;
}

type PosterCopy = {
  headline: (name: string) => string;
  subhead: string;
  cta: string;
  steps: string[];
};

const copyByLanguage: Record<"en" | "zh", PosterCopy> = {
  en: {
    headline: (name) => `${name} Review`,
    subhead: "Thank you for your support. Your review means a lot to us!",
    cta: "Scan the QR code to leave your review",
    steps: [
      '1. Choose "Service Item" and "Service Experience".',
      '2. Tap "Help me write a review".',
      '3. Pick the draft you like, then tap "Use this to post on Google".',
      '4. Choose your star rating on Google and tap "Post".',
    ],
  },
  zh: {
    headline: (name) => `${name} Review 评价`,
    subhead: "感谢您的支持，您的评价对我们很重要！",
    cta: "请扫描二维码，完成评价",
    steps: [
      "1. 选择「服务项目」和「服务体验」",
      "2. 点击「帮我写一段评论」",
      "3. 选择满意的评价，点击「就用这条到 Google 发布」",
      "4. 在 Google 页面选择星级，点击「Post」发布",
    ],
  },
};

let cachedRegularWoff2DataUrl: string | null = null;
let cachedBoldWoff2DataUrl: string | null = null;
let cachedArchivoBoldWoff2DataUrl: string | null = null;

async function loadEmbeddedFonts(): Promise<{ regular: string; bold: string; archivoBold: string }> {
  if (!cachedRegularWoff2DataUrl || !cachedBoldWoff2DataUrl || !cachedArchivoBoldWoff2DataUrl) {
    const [regularBytes, boldBytes, archivoBoldBytes] = await Promise.all([
      readFile(path.join(process.cwd(), "public/fonts/noto-sans-tc-400.woff2")),
      readFile(path.join(process.cwd(), "public/fonts/noto-sans-tc-700.woff2")),
      readFile(path.join(process.cwd(), "public/fonts/archivo-700.woff2")),
    ]);
    cachedRegularWoff2DataUrl = `data:font/woff2;base64,${regularBytes.toString("base64")}`;
    cachedBoldWoff2DataUrl = `data:font/woff2;base64,${boldBytes.toString("base64")}`;
    cachedArchivoBoldWoff2DataUrl = `data:font/woff2;base64,${archivoBoldBytes.toString("base64")}`;
  }
  return {
    regular: cachedRegularWoff2DataUrl,
    bold: cachedBoldWoff2DataUrl,
    archivoBold: cachedArchivoBoldWoff2DataUrl,
  };
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizePosterLanguage(language: Language): "en" | "zh" {
  return language === "zh" ? "zh" : "en";
}

export function resolvePosterLanguage(langParam: string | null): "en" | "zh" {
  return langParam === "zh" ? "zh" : "en";
}

export async function buildQrPosterV3(opts: QrPosterV3Opts): Promise<Uint8Array> {
  const lang = normalizePosterLanguage(opts.language);
  const copy = copyByLanguage[lang];
  const cleanName = normalizeBusinessName(opts.businessName) || "Your Business";
  const headline = copy.headline(cleanName);
  const qrDataUrl = await generateQrDataUrl(opts.url, 960);
  const fonts = await loadEmbeddedFonts();
  const venueLabel = (opts.venueLabel || "").trim().toUpperCase();

  const html = `<!doctype html>
<html lang="${lang === "zh" ? "zh-Hans" : "en"}">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: Letter; margin: 0; }
    @font-face { font-family: "NotoSansTC"; src: url("${fonts.regular}") format("woff2"); font-weight: 400; font-style: normal; font-display: block; }
    @font-face { font-family: "NotoSansTC"; src: url("${fonts.bold}") format("woff2"); font-weight: 700; font-style: normal; font-display: block; }
    @font-face { font-family: "ArchivoPoster"; src: url("${fonts.archivoBold}") format("woff2"); font-weight: 700; font-style: normal; font-display: block; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 8.5in;
      height: 11in;
      background: #faf7f2;
      color: #0f1f1a;
      font-family: "NotoSansTC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .sheet {
      width: 100%;
      height: 100%;
      padding: 0.75in;
    }
    .card {
      width: 100%;
      height: 100%;
      background: #fff;
      border: 1px solid #e8e2d5;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 40px 22px;
      position: relative;
    }
    .logo-wrap {
      margin-top: 2px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .logo {
      position: relative;
      font-family: "ArchivoPoster", "NotoSansTC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 54px;
      font-weight: 700;
      line-height: 0.95;
      letter-spacing: 0.03em;
      color: #0f1f1a;
      display: inline-block;
      padding: 0 4px;
    }
    .logo::after {
      content: "";
      position: absolute;
      left: 27%;
      right: 12%;
      top: 48%;
      border-top: 4px solid #0f1f1a;
      transform: rotate(-8deg);
    }
    .tagline {
      margin-top: 4px;
      font-size: 10px;
      color: #8a938e;
    }
    .headline {
      margin-top: 34px;
      font-size: 52px;
      font-weight: 700;
      line-height: 1.04;
      text-align: center;
      max-width: 100%;
      word-break: keep-all;
      overflow-wrap: normal;
      letter-spacing: 0;
    }
    .headline.en {
      font-family: "ArchivoPoster", "NotoSansTC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 56px;
      line-height: 0.98;
    }
    .subhead {
      margin-top: 10px;
      font-size: 25px;
      color: #5a6660;
      line-height: 1.25;
      text-align: center;
    }
    .qr-frame {
      margin-top: 24px;
      width: 378px;
      height: 378px;
      border: 1px solid #e8e2d5;
      border-radius: 8px;
      background: #fff;
      display: grid;
      place-items: center;
      position: relative;
    }
    .qr {
      width: 322px;
      height: 322px;
      display: block;
    }
    .badge {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 102px;
      height: 102px;
      border-radius: 999px;
      border: 1.5px solid #e8e2d5;
      background: #fff;
      box-shadow: 0 1px 4px rgba(15, 31, 26, 0.1);
      display: grid;
      place-items: center;
      font-size: 30px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #1f4d3f;
      padding-left: 5px;
    }
    .cta {
      margin-top: 22px;
      font-size: 28px;
      font-weight: 700;
      line-height: 1.12;
      text-align: center;
    }
    .steps {
      margin-top: 12px;
      width: 100%;
      max-width: 520px;
      font-size: 13.5px;
      line-height: 1.38;
      color: #5a6660;
      margin-bottom: 132px;
    }
    .steps div { margin: 4px 0; }
    .venue {
      position: absolute;
      bottom: 84px;
      font-size: 11px;
      color: #8a938e;
      font-weight: 700;
      letter-spacing: 0.12em;
    }
    .footer-line {
      position: absolute;
      left: 36px;
      right: 36px;
      bottom: 60px;
      border-top: 1px solid #e8e2d5;
    }
    .footer-web {
      position: absolute;
      bottom: 30px;
      font-size: 18px;
      font-weight: 700;
    }
    .footer-contact {
      position: absolute;
      bottom: 12px;
      font-size: 11px;
      color: #8a938e;
    }
  </style>
</head>
<body>
  <section class="sheet">
    <div class="card">
      <div class="logo-wrap">
        <div class="logo">BAAM</div>
        <div class="tagline">Always On. Always Visible.</div>
      </div>
      <div class="headline ${lang}">${escapeHtml(headline)}</div>
      <div class="subhead">${escapeHtml(copy.subhead)}</div>

      <div class="qr-frame">
        <img class="qr" src="${qrDataUrl}" alt="QR code" />
        <div class="badge">BAAM</div>
      </div>

      <div class="cta">${escapeHtml(copy.cta)}</div>
      <div class="steps">
        ${copy.steps.map((s) => `<div>${escapeHtml(s)}</div>`).join("")}
      </div>
      ${venueLabel ? `<div class="venue">${escapeHtml(venueLabel)}</div>` : ""}

      <div class="footer-line"></div>
      <div class="footer-web">www.baamreview.com</div>
      <div class="footer-contact">BAAM 平台：www.baamplatform.com | baamusa888@gmail.com</div>
    </div>
  </section>
</body>
</html>`;

  const { pdf_buffer } = await renderHtmlToPdf(html);
  return pdf_buffer;
}

function normalizeBusinessName(name: string): string {
  return name
    .replace(/[‘’]/g, "'")
    .replace(/\s+'\s+/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
