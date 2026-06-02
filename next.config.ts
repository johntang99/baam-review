import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Marketing home + pricing are now real Next routes (app/page.tsx,
  // app/pricing, app/pricing/zh) that read the approved HTML from /public
  // and render it server-side. The old "/" → static-file rewrite is gone.

  // Externalize PDF rendering deps so they're loaded via require() at
  // runtime instead of bundled. `@sparticuz/chromium` ships a ~50MB
  // Brotli-compressed Chrome that must be inflated at runtime; `puppeteer`
  // and `puppeteer-core` use Node APIs that don't play nicely with the
  // Next/webpack bundler.
  serverExternalPackages: [
    "puppeteer",
    "puppeteer-core",
    "@sparticuz/chromium",
  ],
};

export default nextConfig;
