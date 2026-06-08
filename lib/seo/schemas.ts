/**
 * Pre-built schema.org JSON-LD payloads, typed as plain objects.
 *
 * Each exported function returns a single schema entity. Compose them
 * by passing an array to <JsonLd> — that component wraps the array in
 * `@graph` per the JSON-LD spec.
 *
 * Style rules I'm following:
 *   - Functions are pure and deterministic — same inputs, same output.
 *     This keeps Lighthouse SEO audits stable.
 *   - `@id` is set on every entity so cross-references between
 *     entities (e.g. an Article's publisher pointing at the
 *     Organization) work via "@id" linking rather than duplicated
 *     blobs.
 *   - All URLs derive from NEXT_PUBLIC_APP_URL — no hardcoded
 *     baamreview.com strings, so preview deploys validate too.
 */

const BASE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://baamreview.com"
).trim();

const ORG_ID = `${BASE_URL}/#organization`;
const WEBSITE_ID = `${BASE_URL}/#website`;

const ORG_NAME = "BAAM Review";
const ORG_LEGAL_NAME = "BAAM Studio";
const ORG_DESCRIPTION =
  "BAAM Review is the review-to-revenue engine for local businesses — bilingual review marketing, free 7-page audits, and a service tier that runs review collection for you.";
const ORG_LOGO_URL = `${BASE_URL}/icon.svg`;
const ORG_SAME_AS: string[] = [
  // Add real social profile URLs as they come online.
  // "https://www.linkedin.com/company/baam-review",
  // "https://www.youtube.com/@baamreview",
];

// ============================================================
// Organization — the publisher behind everything we ship.
// Cite this once per page; other entities reference it via "@id".
// ============================================================
export function organizationSchema(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: ORG_NAME,
    legalName: ORG_LEGAL_NAME,
    url: BASE_URL,
    description: ORG_DESCRIPTION,
    logo: {
      "@type": "ImageObject",
      url: ORG_LOGO_URL,
      width: 512,
      height: 512,
    },
    sameAs: ORG_SAME_AS.length > 0 ? ORG_SAME_AS : undefined,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "service@baamplatform.com",
      availableLanguage: ["English", "Chinese"],
      areaServed: "US",
    },
  };
}

// ============================================================
// WebSite — declares this domain as a searchable site. Also enables
// the Sitelinks search box in Google results when we add SearchAction.
// ============================================================
export function websiteSchema(): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: BASE_URL,
    name: ORG_NAME,
    description: ORG_DESCRIPTION,
    publisher: { "@id": ORG_ID },
    inLanguage: ["en", "zh"],
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/blog?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

// ============================================================
// Service — for /audit/service. Encodes our two pricing tiers as
// schema offers so they're machine-readable.
// ============================================================
export function serviceSchema(): Record<string, unknown> {
  return {
    "@type": "Service",
    "@id": `${BASE_URL}/audit/service#service`,
    name: "BAAM Review · Review-to-Revenue Service",
    serviceType: "Review management for local businesses",
    description:
      "End-to-end review collection, response, and reporting for local businesses. Bilingual support, weekly cadence, no fake reviews.",
    provider: { "@id": ORG_ID },
    areaServed: { "@type": "Country", name: "United States" },
    offers: [
      {
        "@type": "Offer",
        name: "Self-Service",
        description:
          "Self-managed review collection. Owner sends requests, BAAM provides the platform.",
        price: "99",
        priceCurrency: "USD",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: 99,
          priceCurrency: "USD",
          unitText: "MON",
        },
        availability: "https://schema.org/InStock",
        url: `${BASE_URL}/audit/service`,
      },
      {
        "@type": "Offer",
        name: "Full Service",
        description:
          "BAAM runs review collection on your behalf — weekly sends, AI replies, monthly reports.",
        price: "399",
        priceCurrency: "USD",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: 399,
          priceCurrency: "USD",
          unitText: "MON",
        },
        availability: "https://schema.org/InStock",
        url: `${BASE_URL}/audit/service`,
      },
    ],
  };
}

// ============================================================
// ContactPage — declares /contact as a contact entry point.
// ============================================================
export function contactPageSchema(): Record<string, unknown> {
  return {
    "@type": "ContactPage",
    "@id": `${BASE_URL}/contact#page`,
    url: `${BASE_URL}/contact`,
    name: "Contact BAAM Review",
    description:
      "Get in touch with the BAAM Review team. Real humans reply within one business day.",
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": ORG_ID },
  };
}

// ============================================================
// AboutPage — declares /about.
// ============================================================
export function aboutPageSchema(): Record<string, unknown> {
  return {
    "@type": "AboutPage",
    "@id": `${BASE_URL}/about#page`,
    url: `${BASE_URL}/about`,
    name: "About BAAM Review",
    description:
      "BAAM Review builds the review-to-revenue engine local businesses deserve. From BAAM Studio.",
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: { "@id": ORG_ID },
  };
}

// ============================================================
// CollectionPage — for /case-studies and other index pages.
// ============================================================
export function collectionPageSchema(opts: {
  path: string;
  name: string;
  description: string;
}): Record<string, unknown> {
  return {
    "@type": "CollectionPage",
    "@id": `${BASE_URL}${opts.path}#page`,
    url: `${BASE_URL}${opts.path}`,
    name: opts.name,
    description: opts.description,
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": ORG_ID },
  };
}

// ============================================================
// Article — for individual blog posts, research reports,
// case studies. Caller supplies authorial detail.
// ============================================================
export interface ArticleOpts {
  /** Page slug relative to base, e.g. "/blog/5-email-templates". */
  path: string;
  headline: string;
  description: string;
  datePublished: string; // ISO 8601
  dateModified?: string; // ISO 8601, defaults to datePublished
  authorName: string;
  authorUrl?: string;
  imageUrl?: string;
  keywords?: string[];
  inLanguage?: "en" | "zh";
}

export function articleSchema(opts: ArticleOpts): Record<string, unknown> {
  const url = `${BASE_URL}${opts.path}`;
  return {
    "@type": "Article",
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: opts.headline,
    description: opts.description,
    image: opts.imageUrl ? [opts.imageUrl] : undefined,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    author: {
      "@type": "Person",
      name: opts.authorName,
      url: opts.authorUrl,
    },
    publisher: { "@id": ORG_ID },
    inLanguage: opts.inLanguage ?? "en",
    keywords: opts.keywords?.join(", "),
  };
}

// ============================================================
// FAQPage — wraps a list of Q&A entries.
// LLMs aggressively scrape this format for direct answers.
// ============================================================
export interface FaqItem {
  question: string;
  answer: string;
}

export function faqPageSchema(opts: {
  path: string;
  items: FaqItem[];
}): Record<string, unknown> {
  return {
    "@type": "FAQPage",
    "@id": `${BASE_URL}${opts.path}#faq`,
    mainEntity: opts.items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
  };
}

// ============================================================
// LocalBusiness — for /local/[city] pages. Declares BAAM as a
// local-service provider in that city's area.
// ============================================================
export interface LocalBusinessOpts {
  /** Page slug, e.g. "/local/flushing". */
  path: string;
  /** City name as it should appear in search. */
  city: string;
  /** State (US 2-letter code, e.g. "NY"). */
  state: string;
  /** Optional ZIP — improves local-pack eligibility. */
  postalCode?: string;
  /** Country, default US. */
  country?: string;
}

export function localBusinessSchema(
  opts: LocalBusinessOpts,
): Record<string, unknown> {
  const id = `${BASE_URL}${opts.path}#local-business`;
  return {
    "@type": "ProfessionalService",
    "@id": id,
    name: `BAAM Review · ${opts.city}`,
    description: `Review marketing for local businesses in ${opts.city}, ${opts.state}. Free audit. Bilingual support.`,
    url: `${BASE_URL}${opts.path}`,
    parentOrganization: { "@id": ORG_ID },
    areaServed: {
      "@type": "City",
      name: opts.city,
      containedInPlace: { "@type": "State", name: opts.state },
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: opts.city,
      addressRegion: opts.state,
      postalCode: opts.postalCode,
      addressCountry: opts.country ?? "US",
    },
    knowsLanguage: ["English", "Chinese"],
  };
}

// ============================================================
// BreadcrumbList — for content pages with hierarchy
// (e.g. /local/flushing/tcm-clinic-reviews).
// ============================================================
export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function breadcrumbSchema(
  items: BreadcrumbItem[],
): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: it.name,
      item: `${BASE_URL}${it.path}`,
    })),
  };
}
