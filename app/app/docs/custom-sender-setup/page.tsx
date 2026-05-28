import fs from "node:fs";
import path from "node:path";
import { ChevronLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BackLink } from "./back-link";

export const metadata = {
  title: "Custom sender setup — BAAM Review",
};

// IMPORTANT: do NOT mark this page as force-static. The /app/* layout
// requires an authenticated session via cookies; static prerender has no
// cookies so the layout's auth check fails and redirects to /login.
// Default (dynamic per-request) is correct here — the file read is fast
// and Vercel caches at the edge anyway.

export default async function CustomSenderSetupPage() {
  const filePath = path.join(
    process.cwd(),
    "docs",
    "operations",
    "CUSTOM_SENDER_DOMAIN_SETUP.md",
  );
  let markdown = "";
  try {
    markdown = fs.readFileSync(filePath, "utf8");
  } catch {
    markdown =
      "**SOP file not found.** Expected at `docs/operations/CUSTOM_SENDER_DOMAIN_SETUP.md`.";
  }

  return (
    <main className="px-10 py-8 pb-16 max-w-[860px]">
      <BackLink>
        <ChevronLeft className="h-3 w-3" />
        Back
      </BackLink>

      <article
        className="prose-doc"
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </article>

      {/* Minimal typography rules so the rendered markdown reads cleanly
          without pulling in @tailwindcss/typography. Scoped to .prose-doc. */}
      <style>{`
        .prose-doc { color: var(--text, #1A1F1C); line-height: 1.65; font-size: 14.5px; }
        .prose-doc h1 { font-family: 'Fraunces', Georgia, serif; font-size: 32px; font-weight: 500; letter-spacing: -0.02em; margin: 0 0 18px; color: var(--ink, #1A1F1C); }
        .prose-doc h2 { font-family: 'Fraunces', Georgia, serif; font-size: 22px; font-weight: 500; letter-spacing: -0.015em; margin: 36px 0 12px; color: var(--ink, #1A1F1C); border-top: 1px solid #e6e0d4; padding-top: 28px; }
        .prose-doc h2:first-of-type { border-top: 0; padding-top: 0; }
        .prose-doc h3 { font-size: 16.5px; font-weight: 600; margin: 24px 0 10px; color: var(--ink, #1A1F1C); }
        .prose-doc h4 { font-size: 14px; font-weight: 600; margin: 18px 0 8px; color: var(--ink, #1A1F1C); }
        .prose-doc p { margin: 0 0 14px; }
        .prose-doc strong { color: var(--ink, #1A1F1C); font-weight: 600; }
        .prose-doc a { color: var(--forest, #1F4D3F); text-decoration: underline; text-underline-offset: 2px; }
        .prose-doc a:hover { text-decoration: none; }
        .prose-doc ul, .prose-doc ol { margin: 0 0 16px; padding-left: 22px; }
        .prose-doc li { margin: 4px 0; }
        .prose-doc li > input[type="checkbox"] { margin-right: 6px; transform: translateY(1px); }
        .prose-doc code { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12.5px; background: rgba(31, 77, 63, 0.06); padding: 1.5px 5px; border-radius: 4px; color: var(--ink, #1A1F1C); }
        .prose-doc pre { background: #1A1F1C; color: #e8e3d6; padding: 14px 16px; border-radius: 10px; overflow-x: auto; font-size: 12.5px; line-height: 1.55; margin: 12px 0 18px; }
        .prose-doc pre code { background: transparent; padding: 0; color: inherit; font-size: inherit; }
        .prose-doc blockquote { border-left: 3px solid #d4cdb9; padding: 6px 14px; margin: 12px 0 18px; color: var(--text-soft, #4a4a4a); background: rgba(212, 205, 185, 0.18); border-radius: 0 6px 6px 0; }
        .prose-doc table { border-collapse: collapse; margin: 12px 0 20px; width: 100%; font-size: 13px; }
        .prose-doc th, .prose-doc td { border: 1px solid #e6e0d4; padding: 8px 12px; text-align: left; vertical-align: top; }
        .prose-doc th { background: #f3eedf; font-weight: 600; }
        .prose-doc tr:nth-child(even) td { background: rgba(243, 238, 223, 0.4); }
        .prose-doc hr { border: 0; border-top: 1px solid #e6e0d4; margin: 32px 0; }
      `}</style>
    </main>
  );
}
