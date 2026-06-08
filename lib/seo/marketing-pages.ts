/**
 * Registry of marketing pages exposed in the content admin
 * (/admin/marketing). Each entry maps a URL slug to a list of
 * editable named sections.
 *
 * Why we don't allow editing raw HTML: the marketing-*.html files in
 * /public are hand-styled with thousands of lines of CSS. A typo in
 * a structural tag breaks the page layout silently. Instead the
 * admin lets editors override specific named regions (hero title,
 * deck, a couple of paragraphs) — the page reads those overrides at
 * render time and falls back to whatever's in the HTML otherwise.
 *
 * Each field has a kind that drives the editor UI:
 *   - 'text'      → single-line input
 *   - 'textarea'  → multi-line plain text
 *   - 'markdown'  → markdown source + preview
 *   - 'html'      → raw HTML (use sparingly — typically only for
 *                   pre-styled fragments like the hero h1 that
 *                   include <em> emphasis markup)
 */

export type FieldKind = "text" | "textarea" | "markdown" | "html";

export interface EditableField {
  key: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  rows?: number;
}

export interface MarketingPageDef {
  /** URL slug — matches the path. Used as the content_items slug too. */
  slug: string;
  /** Display name shown in the admin list. */
  displayName: string;
  /** Path on the live site (almost always `/${slug}` but kept
   * explicit so we can do `slug='home'` → path='/'). */
  path: string;
  /** Short description shown above the editor form. */
  description: string;
  /** Section definitions — what's editable. */
  fields: EditableField[];
}

export const MARKETING_PAGES: MarketingPageDef[] = [
  {
    slug: "about",
    displayName: "About",
    path: "/about",
    description: "The About page hero, story, principles, and CTA strip.",
    fields: [
      {
        key: "heroEyebrow",
        label: "Hero eyebrow (small mono label)",
        kind: "text",
      },
      {
        key: "heroHeadline",
        label: "Hero headline (HTML with <em> allowed)",
        kind: "html",
        hint: "Use <em>…</em> for the gold italic accent.",
      },
      {
        key: "heroDeck",
        label: "Hero deck (italic sub-headline)",
        kind: "textarea",
        rows: 3,
      },
      {
        key: "storyHeadline",
        label: "Story section headline",
        kind: "text",
      },
      {
        key: "storyBody",
        label: "Story body",
        kind: "markdown",
        rows: 8,
      },
      {
        key: "ctaTitle",
        label: "CTA strip title (HTML with <em> allowed)",
        kind: "html",
      },
    ],
  },
  {
    slug: "contact",
    displayName: "Contact",
    path: "/contact",
    description:
      "The Contact page hero and the left-rail info block. The form itself is wired in code.",
    fields: [
      { key: "heroEyebrow", label: "Hero eyebrow", kind: "text" },
      {
        key: "heroHeadline",
        label: "Hero headline (HTML)",
        kind: "html",
      },
      { key: "heroDeck", label: "Hero deck", kind: "textarea", rows: 3 },
      {
        key: "responseTimeLabel",
        label: "Response time line",
        kind: "text",
        hint: "e.g. 'Usually within one business day.'",
      },
      {
        key: "responseTimeDetail",
        label: "Response time detail",
        kind: "textarea",
        rows: 2,
      },
    ],
  },
  {
    slug: "case-studies",
    displayName: "Case Studies (page chrome)",
    path: "/case-studies",
    description:
      "Hero copy for /case-studies. The individual study cards have their own admin at /admin/case-studies.",
    fields: [
      { key: "heroEyebrow", label: "Hero eyebrow", kind: "text" },
      { key: "heroHeadline", label: "Hero headline (HTML)", kind: "html" },
      { key: "heroDeck", label: "Hero deck", kind: "textarea", rows: 3 },
    ],
  },
];

const PAGES_BY_SLUG: Map<string, MarketingPageDef> = new Map(
  MARKETING_PAGES.map((p) => [p.slug, p]),
);

export function getMarketingPageDef(slug: string): MarketingPageDef | null {
  return PAGES_BY_SLUG.get(slug) ?? null;
}

export function listMarketingPageSlugs(): string[] {
  return MARKETING_PAGES.map((p) => p.slug);
}
