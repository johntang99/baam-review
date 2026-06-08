import React from "react";

interface JsonLdProps {
  /** Either a single schema.org object or an array. Arrays render as
   *  a JSON-LD `@graph` so all the entities share one `<script>` tag
   *  rather than us emitting N scripts on one page. */
  data: Record<string, unknown> | Array<Record<string, unknown>>;
  /** Stable id is useful if the same page renders the schema in a
   *  React.StrictMode double-render — same id keeps the DOM stable. */
  id?: string;
}

/**
 * Server-renderable JSON-LD injector. Used to attach schema.org
 * markup (Organization, WebSite, Article, FAQPage, etc.) to any page
 * in the App Router.
 *
 * Why a custom component rather than `<Script type="application/ld+json">`:
 *   - Lives in the static HTML at first paint (no hydration race —
 *     crawlers see it instantly)
 *   - Single source of typing for the schema payload
 *   - `dangerouslySetInnerHTML` is safe here because the input is a
 *     trusted object we serialize with JSON.stringify (no user input)
 *
 * Usage:
 *   import { JsonLd } from "@/components/seo/JsonLd";
 *   import { organizationSchema, websiteSchema } from "@/lib/seo/schemas";
 *
 *   return (
 *     <>
 *       <JsonLd data={[organizationSchema(), websiteSchema()]} />
 *       {/* rest of page * /}
 *     </>
 *   );
 *
 * When passing an array, the component wraps them in `@graph` per the
 * schema.org JSON-LD spec — search engines and AI crawlers expect this
 * pattern when multiple entities share a page.
 */
export function JsonLd({ data, id }: JsonLdProps) {
  const payload = Array.isArray(data)
    ? { "@context": "https://schema.org", "@graph": data }
    : { "@context": "https://schema.org", ...data };

  // JSON.stringify with a replacer to strip any undefined values —
  // some schema helpers conditionally include fields, and undefined
  // would render as `null` which is technically valid but adds noise
  // when humans (or LLMs) read the source.
  const json = JSON.stringify(payload, (_, v) => v ?? undefined);

  return (
    <script
      type="application/ld+json"
      id={id}
      // The payload is built server-side from typed helpers; no user
      // input ever lands here, so dangerouslySetInnerHTML is safe.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
