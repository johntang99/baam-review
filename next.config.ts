import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  /**
   * Serve the static marketing prototype at "/" instead of the older
   * app/page.tsx. `beforeFiles` runs before the file-system router so the
   * static HTML in public/marketing-home.html wins. When we eventually
   * convert the prototype to JSX, delete this rewrite and the new page.tsx
   * will take over.
   */
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/marketing-home.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
