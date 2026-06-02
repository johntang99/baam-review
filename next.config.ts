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

  // Externalizing keeps the JS out of the bundle, but Vercel's file tracer
  // also needs to ship @sparticuz/chromium's `bin/` directory (the
  // Brotli-compressed Chrome binary). Without these globs the package is
  // present at runtime but `executablePath()` can't find the tar to inflate.
  // Both the public path and the pnpm `.pnpm/` path are listed because pnpm
  // symlinks the package and the tracer doesn't always follow symlinks.
  outputFileTracingIncludes: {
    "/audit/**": [
      "./node_modules/@sparticuz/chromium/**",
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/**",
    ],
    "/api/**": [
      "./node_modules/@sparticuz/chromium/**",
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/**",
    ],
  },
};

export default nextConfig;
