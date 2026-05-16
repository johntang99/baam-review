import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Approach B (production push): the approved marketing prototypes ship
 * pixel-for-pixel. Rather than hand-porting ~7k lines of bespoke CSS to
 * Tailwind (high regression risk), the HTML+CSS lives in /public and each
 * real Next route reads it server-side and renders it. The prototype's own
 * <script> is dropped here and re-implemented as a typed client component
 * (lib/marketing/MarketingScripts) so behaviour is owned by the codebase.
 *
 * Files are read from /public so they're part of the deployed bundle and
 * remain the single source of truth (no giant template literals to escape).
 */
export interface MarketingDoc {
  /** Contents of the prototype's <style> block (no tags). */
  css: string;
  /** Inner HTML of <body>, with <script> blocks stripped. */
  bodyHtml: string;
}

const STYLE_RE = /<style[^>]*>([\s\S]*?)<\/style>/i;
const BODY_RE = /<body[^>]*>([\s\S]*?)<\/body>/i;
const SCRIPT_RE = /<script[\s\S]*?<\/script>/gi;

export function readMarketingDoc(publicFile: string): MarketingDoc {
  const full = fs.readFileSync(
    path.join(process.cwd(), "public", publicFile),
    "utf8",
  );
  const css = STYLE_RE.exec(full)?.[1]?.trim() ?? "";
  const bodyRaw = BODY_RE.exec(full)?.[1] ?? "";
  const bodyHtml = bodyRaw.replace(SCRIPT_RE, "").trim();
  return { css, bodyHtml };
}
