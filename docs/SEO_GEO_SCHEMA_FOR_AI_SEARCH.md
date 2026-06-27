# GEO Schema for AI Search

**Owner:** BAAM Review  
**Last updated:** 2026-06-26  
**Purpose:** Clarify what is actually "new" in schema work for AI search (GEO), and what to implement now.

---

## 1) Short answer

There is no universally adopted "AI-only schema" standard yet.

For GEO, the practical upgrade is:

- stronger entity graph (`@id`, `sameAs`, `mainEntity`, `about`, `mentions`)
- cleaner provenance (`author`, `publisher`, `datePublished`, `dateModified`)
- tighter consistency between structured data, visible page content, and external listings

In other words: **better connected Schema.org**, not a brand-new vocabulary.

---

## 2) What changed for AI search behavior

AI search engines and answer engines care more about:

1. **Entity certainty**  
   Can the system confidently identify who this business/person/page is?

2. **Source reliability**  
   Is authorship clear? Is publisher clear? Is this page current?

3. **Answer extraction quality**  
   Is content structured so models can safely quote/summarize?

4. **Cross-surface consistency**  
   Does schema agree with visible text, metadata, and external references (GBP, social, directories)?

Schema helps with all four when implemented as a connected graph.

---

## 3) Recommended schema stack (priority order)

### P0 (must have)

- `Organization` or `LocalBusiness` (choose one primary business entity per site)
- `WebSite`
- `WebPage` on key pages
- `BreadcrumbList`

### P1 (high impact by page type)

- `Service` (+ `Offer`) for service pages
- `Product` (+ `Offer`) for product pages
- `Article` / `BlogPosting` for editorial content
- `FAQPage` (only when FAQs are visibly on-page)
- `ContactPage` for contact page

### P2 (optional but useful)

- `HowTo` and `QAPage` when content truly matches those formats
- `VideoObject` when first-party video content exists
- `Dataset` for research/data-heavy pages

---

## 4) GEO-focused field upgrades

Use these fields more intentionally for AI search:

- `@id`: stable canonical IDs for entity nodes
- `sameAs`: high-confidence profiles/listings only
- `mainEntity` / `mainEntityOfPage`: explicit page-entity relationship
- `about` / `mentions`: topic and entity context for the page
- `inLanguage`: especially important for multilingual pages (`en`, `zh`)
- `author`, `publisher`, `datePublished`, `dateModified`: provenance/freshness
- `areaServed`, `serviceType`, `hasOfferCatalog`: local/service clarity
- `knowsAbout`: expertise signaling (use only factual, defensible topics)

---

## 5) Minimal connected graph pattern

Use JSON-LD with a compact `@graph` so pages reference the same business entity.

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "LocalBusiness",
      "@id": "https://example.com/#business",
      "name": "Example Local Business",
      "url": "https://example.com/",
      "telephone": "+1-212-555-0100",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "123 Main St",
        "addressLocality": "New York",
        "addressRegion": "NY",
        "postalCode": "10001",
        "addressCountry": "US"
      },
      "sameAs": [
        "https://www.google.com/maps?cid=1234567890"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://example.com/#website",
      "url": "https://example.com/",
      "name": "Example Local Business",
      "publisher": { "@id": "https://example.com/#business" }
    },
    {
      "@type": "WebPage",
      "@id": "https://example.com/service-page/#webpage",
      "url": "https://example.com/service-page/",
      "name": "Service Page Title",
      "isPartOf": { "@id": "https://example.com/#website" },
      "about": { "@id": "https://example.com/#business" },
      "mainEntity": { "@id": "https://example.com/service-page/#service" },
      "inLanguage": "en"
    },
    {
      "@type": "Service",
      "@id": "https://example.com/service-page/#service",
      "name": "Primary Service Name",
      "provider": { "@id": "https://example.com/#business" },
      "areaServed": "New York Metro",
      "serviceType": "Local service type",
      "offers": {
        "@type": "Offer",
        "url": "https://example.com/pricing/"
      }
    }
  ]
}
```

---

## 6) GEO-specific implementation rules

1. **One canonical entity ID per business**  
   Reuse the same `LocalBusiness`/`Organization` `@id` across all pages.

2. **Schema must match visible content**  
   Do not mark up data that users cannot see or verify.

3. **Use page-accurate types only**  
   Do not use `FAQPage` unless real FAQ blocks are present on-page.

4. **Keep multilingual pages language-explicit**  
   Add `inLanguage` and ensure each localized URL has matching localized schema.

5. **Avoid review spam markup**  
   Only include ratings/reviews when policy-valid and displayed appropriately.

---

## 7) Validation workflow

Before publishing each page:

- Validate JSON-LD syntax
- Validate schema type/field usage (Schema.org + Google rich result tools)
- Confirm canonical/hreflang alignment
- Confirm structured data matches visible page text
- Confirm sitemap includes the URL and lastmod is current

After publishing:

- Check Search Console enhancement reports
- Re-crawl via URL Inspection
- Monitor impressions/clicks and rich result eligibility trends

---

## 8) Common mistakes to avoid

- Creating disconnected schema blocks with no shared `@id`
- Injecting generic templates without page-specific data
- Claiming unsupported entities (fake authors, inflated credentials)
- Marking hidden content as FAQ/HowTo
- Letting `dateModified` drift out of sync with real updates

---

## 9) Practical GEO takeaway

For AI search, schema is now less about chasing rich snippets and more about:

- building a consistent machine-readable knowledge graph of your business
- improving answer engine confidence in your pages as citable sources
- reducing ambiguity across your site, GBP/listings, and social profiles

If implementation time is limited, prioritize:

1. `LocalBusiness`/`Organization` entity quality
2. `WebPage` + `mainEntity` relationships on money pages
3. provenance fields on articles and key landing pages
