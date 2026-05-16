import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Marketing home + pricing are now real Next routes (app/page.tsx,
  // app/pricing, app/pricing/zh) that read the approved HTML from /public
  // and render it server-side. The old "/" → static-file rewrite is gone.
};

export default nextConfig;
