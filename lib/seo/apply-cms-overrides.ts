import "server-only";
import {
  getMarketingPageDef,
  type EditableField,
  type FieldKind,
} from "@/lib/seo/marketing-pages";
import { getPublishedContent } from "@/lib/admin/content";

/**
 * Apply CMS overrides to a marketing page's static HTML.
 *
 * Convention: each editable region in /public/marketing-*.html is
 * wrapped in HTML comments like:
 *
 *   <!--cms:heroHeadline-->Default copy here<!--/cms-->
 *
 * The applier finds these blocks, looks up the override value in the
 * content_items DB row (kind='marketing_page', slug=<page slug>),
 * and replaces the inner content per the field's kind:
 *
 *   - 'text'     → HTML-escaped
 *   - 'textarea' → HTML-escaped, newlines → <br>
 *   - 'html'     → injected as-is
 *   - 'markdown' → tiny inline md→html converter (paragraphs, **bold**,
 *                  *italic*, [links], headings, lists)
 *
 * If the override is empty (or missing), the default content in the
 * HTML between the markers is left alone — so the page always
 * renders something even before any overrides are saved.
 */

/** Fetch overrides for a slug and apply them to the page HTML. */
export async function applyMarketingOverrides(
  html: string,
  slug: string,
): Promise<string> {
  const def = getMarketingPageDef(slug);
  if (!def) return html;

  const item = await getPublishedContent("marketing_page", slug, "en").catch(
    () => null,
  );
  if (!item) return html;

  const fm = (item.frontmatter as Record<string, unknown>) ?? {};
  const fieldsByKey = new Map<string, EditableField>(
    def.fields.map((f) => [f.key, f]),
  );

  return replaceMarkers(html, (key, originalInner) => {
    const field = fieldsByKey.get(key);
    if (!field) return originalInner;
    const rawValue = fm[key];
    if (typeof rawValue !== "string" || rawValue.trim() === "") {
      return originalInner;
    }
    return renderOverride(field.kind, rawValue);
  });
}

/** Public for unit tests + composability. */
export function replaceMarkers(
  html: string,
  resolve: (key: string, originalInner: string) => string,
): string {
  // Find every <!--cms:KEY-->INNER<!--/cms--> block. INNER is non-
  // greedy so nested unrelated markers don't span past their own
  // closer. Multiline matching via [\s\S]* to handle wrapped text.
  const re = /<!--\s*cms:([A-Za-z0-9_]+)\s*-->([\s\S]*?)<!--\s*\/cms\s*-->/g;
  return html.replace(re, (_m, key: string, inner: string) => {
    const next = resolve(key, inner);
    // Re-wrap with the same markers so a single render pass is idempotent
    // and the page can be re-applied without losing the markers.
    return `<!--cms:${key}-->${next}<!--/cms-->`;
  });
}

function renderOverride(kind: FieldKind, value: string): string {
  switch (kind) {
    case "text":
      return escapeHtml(value);
    case "textarea":
      return escapeHtml(value).replace(/\r?\n/g, "<br>");
    case "html":
      return value; // trust — staff-only input
    case "markdown":
      return renderMarkdown(value);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Minimal markdown → HTML converter. Handles the small subset of
 * markdown that marketing override fields actually use:
 *   - # heading
 *   - paragraphs (blank-line separated)
 *   - **bold**, *italic*
 *   - [link text](url)
 *   - `inline code`
 *   - `-` and `1.` lists
 *
 * Anything fancier (code fences, tables, blockquotes) is left
 * untouched, which is fine because the editor's preview shows the
 * author what'll render — they can self-limit.
 *
 * Why we don't pull in a full markdown lib: marketing override fields
 * are short. A ~50-line converter ships now and keeps the bundle
 * lean. If editors start writing real long-form content here we'd
 * swap in `marked` or `remark` + `remark-html`.
 */
function renderMarkdown(md: string): string {
  // Split on blank lines into block-level chunks.
  const blocks = md.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const out: string[] = [];

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    // Headings
    const heading = block.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    // Unordered list — every line starts with - or *
    if (/^(\s*[-*]\s+)/.test(block) && block.split(/\n/).every((l) => /^\s*[-*]\s+/.test(l) || l.trim() === "")) {
      const items = block
        .split(/\n/)
        .filter((l) => l.trim())
        .map((l) => l.replace(/^\s*[-*]\s+/, ""))
        .map((item) => `<li>${renderInline(item)}</li>`)
        .join("");
      out.push(`<ul>${items}</ul>`);
      continue;
    }

    // Ordered list — every line starts with N.
    if (/^(\s*\d+\.\s+)/.test(block) && block.split(/\n/).every((l) => /^\s*\d+\.\s+/.test(l) || l.trim() === "")) {
      const items = block
        .split(/\n/)
        .filter((l) => l.trim())
        .map((l) => l.replace(/^\s*\d+\.\s+/, ""))
        .map((item) => `<li>${renderInline(item)}</li>`)
        .join("");
      out.push(`<ol>${items}</ol>`);
      continue;
    }

    // Paragraph: collapse internal newlines to spaces, render inline.
    const paragraph = block.replace(/\n+/g, " ");
    out.push(`<p>${renderInline(paragraph)}</p>`);
  }

  return out.join("\n");
}

/** Inline-level transforms: bold, italic, code, links. Order matters:
 *  escape first, then bold (greediest token), then italic, then code,
 *  then links. */
function renderInline(s: string): string {
  let out = escapeHtml(s);
  // **bold**
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // *italic*
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  // `code`
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  // [text](url) — restrict url to safe schemes only.
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+|\/[^)]*|mailto:[^)]+)\)/g,
    '<a href="$2">$1</a>',
  );
  return out;
}
