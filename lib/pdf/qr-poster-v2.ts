import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import { generateQrPng } from "@/lib/qr";
import type { Language } from "@/lib/i18n/review";

export interface QrPosterV2Opts {
  businessName: string;
  url: string;
  language: "en" | "zh";
  venueLabel?: string;
}

const INK = rgb(15 / 255, 31 / 255, 26 / 255);
const FOREST = rgb(31 / 255, 77 / 255, 63 / 255);
const TEXT_SOFT = rgb(90 / 255, 102 / 255, 96 / 255);
const TEXT_MUTED = rgb(138 / 255, 147 / 255, 142 / 255);
const CREAM = rgb(250 / 255, 247 / 255, 242 / 255);
const BORDER = rgb(232 / 255, 226 / 255, 213 / 255);

const PAGE_W = 612;
const PAGE_H = 792;
const CARD_X = 54;
const CARD_Y = 54;
const CARD_W = PAGE_W - 2 * CARD_X;
const CARD_H = PAGE_H - 2 * CARD_Y;

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

let cachedRegularFontBytes: Buffer | null = null;
let cachedBoldFontBytes: Buffer | null = null;

async function loadNotoSansTcFonts(): Promise<{ regular: Buffer; bold: Buffer }> {
  if (!cachedRegularFontBytes || !cachedBoldFontBytes) {
    const regularPath = path.join(process.cwd(), "public/fonts/noto-sans-tc-400.woff2");
    const boldPath = path.join(process.cwd(), "public/fonts/noto-sans-tc-700.woff2");
    [cachedRegularFontBytes, cachedBoldFontBytes] = await Promise.all([
      readFile(regularPath),
      readFile(boldPath),
    ]);
  }
  return { regular: cachedRegularFontBytes, bold: cachedBoldFontBytes };
}

function pickFitSize(
  font: PDFFont,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
): number {
  for (let size = startSize; size >= minSize; size -= 1) {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return size;
  }
  return minSize;
}

export function resolvePosterLanguage(langParam: string | null): "en" | "zh" {
  if (langParam === "zh") return "zh";
  return "en";
}

function normalizePosterLanguage(language: Language): "en" | "zh" {
  return language === "zh" ? "zh" : "en";
}

export async function buildQrPosterV2(opts: QrPosterV2Opts): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`BAAM Review · ${opts.businessName}`);
  pdf.setCreator("BAAM Review");

  const { regular, bold } = await loadNotoSansTcFonts();
  const baseFont = await pdf.embedFont(regular, { subset: true });
  const baseFontBold = await pdf.embedFont(bold, { subset: true });

  const qrPng = await generateQrPng(opts.url, 1024);
  const qrImage = await pdf.embedPng(qrPng);

  const lang = normalizePosterLanguage(opts.language);
  const copy = copyByLanguage[lang];
  const cleanName = opts.businessName.trim() || "Your Business";
  const headline = copy.headline(cleanName);

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
  page.drawRectangle({
    x: CARD_X,
    y: CARD_Y,
    width: CARD_W,
    height: CARD_H,
    color: rgb(1, 1, 1),
    borderColor: BORDER,
    borderWidth: 1,
  });

  const logo = "BAAM";
  const logoSize = 28;
  const logoWidth = baseFontBold.widthOfTextAtSize(logo, logoSize);
  page.drawText(logo, {
    x: PAGE_W / 2 - logoWidth / 2,
    y: PAGE_H - CARD_Y - 52,
    size: logoSize,
    font: baseFontBold,
    color: INK,
  });

  const logoTagline = "Always On. Always Visible.";
  const logoTaglineSize = 8;
  const logoTaglineWidth = baseFont.widthOfTextAtSize(logoTagline, logoTaglineSize);
  page.drawText(logoTagline, {
    x: PAGE_W / 2 - logoTaglineWidth / 2,
    y: PAGE_H - CARD_Y - 64,
    size: logoTaglineSize,
    font: baseFont,
    color: TEXT_MUTED,
  });

  const headlineSize = pickFitSize(baseFontBold, headline, CARD_W - 80, 38, 22);
  const headlineWidth = baseFontBold.widthOfTextAtSize(headline, headlineSize);
  page.drawText(headline, {
    x: PAGE_W / 2 - headlineWidth / 2,
    y: PAGE_H - CARD_Y - 138,
    size: headlineSize,
    font: baseFontBold,
    color: INK,
  });

  const subheadSize = 18;
  const subheadWidth = baseFont.widthOfTextAtSize(copy.subhead, subheadSize);
  page.drawText(copy.subhead, {
    x: PAGE_W / 2 - subheadWidth / 2,
    y: PAGE_H - CARD_Y - 174,
    size: subheadSize,
    font: baseFont,
    color: TEXT_SOFT,
  });

  const qrFrameSize = 372;
  const qrFrameX = PAGE_W / 2 - qrFrameSize / 2;
  const qrFrameY = PAGE_H / 2 - qrFrameSize / 2 - 20;
  page.drawRectangle({
    x: qrFrameX,
    y: qrFrameY,
    width: qrFrameSize,
    height: qrFrameSize,
    color: rgb(1, 1, 1),
    borderColor: BORDER,
    borderWidth: 1,
  });

  const qrSize = 322;
  const qrX = PAGE_W / 2 - qrSize / 2;
  const qrY = PAGE_H / 2 - qrSize / 2;
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  const badgeRadius = 34;
  const badgeCenterX = qrX + qrSize / 2;
  const badgeCenterY = qrY + qrSize / 2;
  page.drawCircle({
    x: badgeCenterX,
    y: badgeCenterY,
    size: badgeRadius,
    color: rgb(1, 1, 1),
    borderColor: BORDER,
    borderWidth: 1.5,
  });
  const badgeText = "BAAM";
  const badgeSize = 17;
  const badgeTextWidth = baseFontBold.widthOfTextAtSize(badgeText, badgeSize);
  page.drawText(badgeText, {
    x: badgeCenterX - badgeTextWidth / 2,
    y: badgeCenterY - badgeSize / 2 + 3,
    size: badgeSize,
    font: baseFontBold,
    color: FOREST,
  });

  const ctaSize = 24;
  const ctaWidth = baseFontBold.widthOfTextAtSize(copy.cta, ctaSize);
  page.drawText(copy.cta, {
    x: PAGE_W / 2 - ctaWidth / 2,
    y: qrFrameY - 45,
    size: ctaSize,
    font: baseFontBold,
    color: INK,
  });

  const stepsSize = 12.5;
  let stepsY = qrFrameY - 76;
  const stepsX = CARD_X + 38;
  for (const step of copy.steps) {
    page.drawText(step, {
      x: stepsX,
      y: stepsY,
      size: stepsSize,
      font: baseFont,
      color: TEXT_SOFT,
    });
    stepsY -= 24;
  }

  if (opts.venueLabel) {
    const venue = opts.venueLabel.trim().toUpperCase();
    const venueSize = 9;
    const venueWidth = baseFontBold.widthOfTextAtSize(venue, venueSize);
    page.drawText(venue, {
      x: PAGE_W / 2 - venueWidth / 2,
      y: CARD_Y + 62,
      size: venueSize,
      font: baseFontBold,
      color: TEXT_MUTED,
    });
  }

  page.drawLine({
    start: { x: CARD_X + 36, y: CARD_Y + 50 },
    end: { x: PAGE_W - CARD_X - 36, y: CARD_Y + 50 },
    thickness: 1,
    color: BORDER,
  });

  const web = "www.baamreview.com";
  const webSize = 15;
  const webWidth = baseFontBold.widthOfTextAtSize(web, webSize);
  page.drawText(web, {
    x: PAGE_W / 2 - webWidth / 2,
    y: CARD_Y + 30,
    size: webSize,
    font: baseFontBold,
    color: INK,
  });

  const contact = "BAAM 平台：www.baamplatform.com | baamusa888@gmail.com";
  const contactSize = 9.5;
  const contactWidth = baseFont.widthOfTextAtSize(contact, contactSize);
  page.drawText(contact, {
    x: PAGE_W / 2 - contactWidth / 2,
    y: CARD_Y + 14,
    size: contactSize,
    font: baseFont,
    color: TEXT_MUTED,
  });

  return pdf.save();
}
