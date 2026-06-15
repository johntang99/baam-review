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
/**
 * Launch can throw `spawn ETXTBSY` ("text file busy") in production: the
 * @sparticuz/chromium binary is extracted to /tmp and then executed, and the
 * OS refuses to spawn it while its write handle isn't fully flushed/closed —
 * or while a concurrent audit is extracting to the same path. It's transient,
 * so retry a few times with a short backoff before giving up.
 */
async function launchWithRetry<T>(
  launch: () => Promise<T>,
  attempts = 4,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await launch();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!/ETXTBSY/i.test(msg)) throw e; // only retry the binary-busy race
      console.warn(
        `[pdf] chromium launch hit ETXTBSY (attempt ${i + 1}/${attempts}); retrying`,
      );
      await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
  }
  throw lastErr;
}

async function doLaunch() {
  if (process.env.NODE_ENV === "production") {
    const [{ default: chromium }, puppeteer] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);
    const executablePath = await chromium.executablePath();
    return launchWithRetry(() =>
      puppeteer.launch({
        args: chromium.args,
        executablePath,
        headless: true,
      }),
    );
  }
  const puppeteer = await import("puppeteer");
  return launchWithRetry(() =>
    puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    }),
  );
}

// Serialize launches within a single (warm) serverless instance. The ETXTBSY
// race is two concurrent invocations extracting + spawning the same /tmp
// Chromium binary at once; chaining launches means only one extracts/spawns at
// a time (subsequent launches find the binary already extracted → fast). This
// + launchWithRetry makes the launch effectively race-free.
let launchGate: Promise<unknown> = Promise.resolve();

async function launchBrowser() {
  const run = launchGate.then(doLaunch, doLaunch);
  launchGate = run.catch(() => {}); // next launch waits regardless of outcome
  return run;
}

export async function renderHtmlToPdf(html: string): Promise<PdfRenderResult> {
  const t0 = Date.now();

  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    // Load the DOM + stylesheets, but never let a slow/unreachable font CDN
    // stall the render. Both waits are capped so generation can't hang
    // forever (the failure mode: document.fonts.ready never resolves when a
    // web font request hangs instead of failing). Worst case we render with
    // whatever fonts loaded rather than blocking the whole pipeline.
    await page
      .setContent(html, { waitUntil: "load", timeout: 25000 })
      .catch((e: unknown) => {
        console.warn(
          "[pdf] setContent did not fully settle, continuing:",
          e instanceof Error ? e.message : String(e),
        );
      });
    await Promise.race([
      page.evaluateHandle("document.fonts.ready"),
      new Promise((resolve) => setTimeout(resolve, 12000)),
    ]);

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
