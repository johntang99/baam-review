import "server-only";
import puppeteer from "puppeteer";

export interface PdfRenderResult {
  pdf_buffer: Uint8Array;
  page_count: number;
  generation_time_ms: number;
}

export async function renderHtmlToPdf(html: string): Promise<PdfRenderResult> {
  const t0 = Date.now();

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluateHandle("document.fonts.ready");

    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
    });

    const pageCount = (html.match(/<section class="page"/g) ?? []).length;

    return {
      pdf_buffer: pdfBuffer,
      page_count: pageCount,
      generation_time_ms: Date.now() - t0,
    };
  } finally {
    await browser.close();
  }
}
