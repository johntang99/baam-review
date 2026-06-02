import "server-only";

export interface PdfRenderResult {
  pdf_buffer: Uint8Array;
  page_count: number;
  generation_time_ms: number;
}

/**
 * Two Chrome binaries:
 *
 *   Dev (NODE_ENV=development) — full `puppeteer` package, which ships
 *   its own Chrome binary. Convenient locally, but ~300MB so it can't
 *   be deployed to Vercel/Lambda.
 *
 *   Prod — `puppeteer-core` (the API only, no bundled Chrome) plus
 *   `@sparticuz/chromium` (a slim Chrome built specifically for Lambda
 *   environments, ~50MB compressed). This is the only combination that
 *   fits inside Vercel's serverless function size limit.
 */
async function launchBrowser() {
  if (process.env.NODE_ENV === "production") {
    const [{ default: chromium }, puppeteer] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const puppeteer = await import("puppeteer");
  return puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

export async function renderHtmlToPdf(html: string): Promise<PdfRenderResult> {
  const t0 = Date.now();

  const browser = await launchBrowser();

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
