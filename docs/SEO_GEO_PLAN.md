# BAAM Review · SEO + GEO Plan

**Owner:** John Tang
**Drafted:** 2026-06-06
**Status:** Draft for review

A practical organic-growth plan for BAAM Review and BAAM Audit. Covers
classic SEO, local SEO, content strategy, GEO (Generative Engine
Optimization — showing up in ChatGPT / Perplexity / Claude / Google AI
Overviews), distribution, and bilingual reach. Time horizon: 12 months.

The plan is opinionated. Decisions can be revisited, but the structure
assumes BAAM's specific moats: a bilingual audience, a working audit
pipeline that produces original data, and an audit-led top of funnel.

---

## 1 · Strategic frame

### 1.1 What BAAM is actually competing for

| Motion | Intent | Conversion | BAAM fit |
|---|---|---|---|
| Local-business owner search | "how do I get more Google reviews for my dental practice" | Very high | **Strongest** |
| Alternative / comparison search | "Birdeye alternatives", "Podium vs BAAM Review" | High | Strong (price + positioning angle) |
| Generic SaaS search | "best review management tool" | Medium | Weak (Birdeye / Podium own this) |

**Rule of thumb:** don't try to outrank Birdeye on "review management
software." We will lose. Win the long tail of *owner-intent* queries
where 3-page Birdeye blog posts are too generic and our real audit data,
bilingual angle, and case studies make us the authoritative answer.

### 1.2 The unfair advantages we lean on

1. **A working audit engine.** We can produce original data at will — vertical medians, regional snapshots, before-and-after numbers. Birdeye writes from secondary sources. We can write from primary data.
2. **Bilingual capability (EN + 中文).** Most US-based competitors treat Chinese-language users as an afterthought. We treat them as default. Almost no real competition in the 华人 small-business SEO niche.
3. **An audit-led top of funnel.** "Get your free 7-page audit" is a stronger lead magnet than "Get a free trial." Anything that drives traffic to the audit converts.
4. **Real client case studies under development.** Once published, these become evergreen credibility assets.

---

## 2 · Technical SEO foundation

Non-negotiable basics, ordered by impact. Most of this is a **one-week
sprint** to set up and then never touch again.

### 2.1 Index + crawlability

1. **`app/sitemap.ts`** auto-includes every public route: `/`, `/about`, `/case-studies`, `/contact`, `/audit`, `/audit/service`, `/zh`, `/legal/*`, plus every blog post and city page once they exist. Rebuilds on deploy.
2. **`app/robots.ts`** allows everything except `/app/*`, `/api/*`, `/auth/*`, `/login`, `/signup`. References the sitemap URL.
3. **Submit to:**
   - Google Search Console
   - Bing Webmaster Tools
   - IndexNow (Bing's instant-index API — one POST per URL on publish)

### 2.2 Per-page metadata

Every page needs:
- `<title>` ≤ 60 characters
- `<meta name="description">` ≤ 155 characters
- `<meta property="og:image">` 1200×630 PNG
- `<link rel="canonical">` pointing at itself

Existing audit pages already do this via Next.js `metadata` exports. We
need to verify each marketing page (About, Case Studies, Contact,
Service) is fully populated.

### 2.3 Schema.org JSON-LD

Add structured data per page type:

| Page | Schema |
|---|---|
| Home (`/`) | `Organization` + `WebSite` (with `SearchAction`) |
| About | `Organization` (founders, location, `sameAs` to social profiles) |
| Case Studies | `ItemList` of `Article` entities, each tagged `Review` or `CaseStudy` |
| Contact | `ContactPage` + `Organization` |
| Service | `Service` with `offers` ($99/$399 tiers) |
| Audit results | `Article` + `Review` (the published audit IS structured data — owners can earn rich snippets) |
| Blog posts | `Article` + `Author` (with `Person` schema and credentials) |
| Local pages | `LocalBusiness` with `areaServed` |

### 2.4 Core Web Vitals

We're on Next.js 16 + Vercel — baseline is fine. After deploying, run
PageSpeed Insights on each page; **LCP > 2.5s on mobile = priority fix.**
The marketing HTML pages we built ship a lot of CSS; if they fail CWV,
consider preloading critical fonts and deferring non-critical CSS.

### 2.5 Bilingual (`hreflang`)

On every page with both EN and ZH versions, declare:

```html
<link rel="alternate" hreflang="en" href="https://baamreview.com/">
<link rel="alternate" hreflang="zh" href="https://baamreview.com/zh">
<link rel="alternate" hreflang="x-default" href="https://baamreview.com/">
```

Without `hreflang`, Google may serve the wrong language version or treat
them as duplicates.

### 2.6 Routing reality check

> **Note on `app/` directory confusion:**
>
> `app/` is the Next.js routing convention, not the authenticated area.
> The authed dashboard lives at `app/app/page.tsx` (URL: `/app`) because
> its parent layout `app/app/layout.tsx` enforces auth via `redirect()`.
>
> SEO routes (`app/sitemap.ts`, `app/local/[city]/page.tsx`, `app/blog/...`)
> are public because no parent layout in their path enforces auth.

### 2.7 Tooling

| Tool | Use | Cost |
|---|---|---|
| Google Search Console | Indexing + ranking | Free |
| Bing Webmaster Tools | Bing + ChatGPT (via Bing index) | Free |
| Screaming Frog SEO Spider | Crawl-error finder | Free up to 500 URLs |
| Ahrefs **or** Semrush | Backlinks, keyword gaps, competitor tracking | ~$99/mo |
| Plausible **or** PostHog | On-site funnels, no cookie banner | Free tier OK to start |

---

## 3 · Local SEO: NY metro → nationwide

### 3.1 Current geography

Based on existing audit data: Manhattan, Flushing, Middletown NY, plus
aspirational reach to Quincy MA, San Gabriel CA. Launch market is NY
metro + tristate. **Chinese-American clusters are the wedge.**

### 3.2 Programmatic city pages

Build `app/local/[city]/page.tsx` that generates a page per market.

```
/local/new-york-city
/local/flushing
/local/brooklyn
/local/queens
/local/manhattan
/local/jersey-city
/local/long-island
```

**Each page needs real content, not boilerplate:**
- City-specific hero ("Review marketing for local businesses in Flushing, Queens")
- Free audit CTA targeting *that* market
- Local stats only we have: "We've audited 47 Flushing businesses. Median Google rating: 4.6. Median review count: 38."
- 3–5 featured case studies from that city
- "Common questions from [city] business owners" Q&A block (with `FAQPage` schema — wins AI search citations)
- `LocalBusiness` schema for BAAM Review with `areaServed`

> **Discipline:** ship 8 great pages, monitor what ranks, expand. Google's
> helpful-content update punishes mass-generated location pages with
> recycled content — but rewards data-driven pages with original metrics.

### 3.3 Industry × city long-tail pages

The real organic-traffic gold: `/local/[city]/[vertical]`.

```
/local/flushing/tcm-clinic-reviews
/local/manhattan/dental-practice-reviews
/local/los-angeles/acupuncture-reviews
```

Pull live competitor data from the audit pipeline → publish *"How TCM
clinics in Flushing rank on Google reviews (June 2026 snapshot)."*
Include real names of the top 5, their review counts, what leaders do
differently, and an embedded CTA: "Run your own audit free →".

**This is what nobody else has the infrastructure to produce.** The
audit engine is literally a content factory.

### 3.4 Going nationwide

Don't expand by "we serve all 50 states." Expand **vertical-first, then
by metro**:

| Wave | When | Markets | Wedge |
|---|---|---|---|
| 1 | Now | NY metro (bilingual) | Chinese-American TCM, medical, salon |
| 2 | Mo. 2–3 | LA, SF Bay, Boston, Toronto, Vancouver | Same bilingual clusters |
| 3 | Mo. 4–6 | Top 50 metros, vertical-first | Dental, salon/spa, real estate |
| 4 | Mo. 6–12 | National | All verticals |

The Chinese-bilingual angle is the unfair advantage. Lock it in first;
nobody else competes seriously in that niche.

---

## 4 · Content strategy

Build **four content pillars**, each with a hub page + 8–12 spoke
articles linking back to the hub.

### 4.1 Pillar 1 — "Get more Google reviews" (hub: `/blog`)

The biggest search-volume cluster. Spoke topics:

- How to ask customers for a Google review without sounding desperate
- 5 review-request email templates that get a 30%+ reply rate
- How often should you reply to Google reviews? (we analyzed N,NNN) ← *uses our data*
- What to do about a fake 1-star Google review
- The 4.0-star threshold and why it matters more than your total count

### 4.2 Pillar 2 — Industry-specific (hub: `/industries`)

**Highest conversion intent.** One page per vertical:

- `/industries/tcm-acupuncture`
- `/industries/dental`
- `/industries/salon-spa`
- `/industries/restaurants`
- `/industries/legal-immigration`
- `/industries/real-estate`

Each becomes its own hub for vertical-specific spokes:

- What's a good Google rating for a dental practice? (medians by region)
- How dental practices handle review responses without violating HIPAA
- Why TCM clinics in Chinese-speaking markets need bilingual reviews

### 4.3 Pillar 3 — Comparison / Alternatives (hub: `/compare`)

**Bottom-funnel intent.** People searching "Birdeye alternative" are
~10× more likely to buy than people searching "best review tool."

- `/compare/birdeye` (honest comparison, no slamming)
- `/compare/podium`
- `/compare/grade-us`
- `/compare/diy-vs-baam-review` (spreadsheet-and-Gmail competitor)
- `/compare/free-vs-paid-review-tools`

### 4.4 Pillar 4 — Research & Reports (hub: `/research`)

**Strongest GEO play.** Use the audit engine to publish original
studies LLMs and journalists will cite:

- Quarterly: "The State of Local Reviews in [Year]" — medians, distributions, vertical breakdowns
- "AI search now reads your reviews: which platforms feed which LLMs (2026)"
- "Velocity decay: what happens to Google rankings when a business stops collecting reviews"
- "Per-review dollar value by vertical: 14 industries, N,NNN audits"

This is the content that earns backlinks from journalists and trade
publications. Birdeye does this; we should do it better because our data
is fresher and more vertical-specific.

### 4.5 First 90-day content calendar

| Week | Pillar 1 | Pillar 2 | Pillar 3 | Pillar 4 |
|---|---|---|---|---|
| 1 | "5 email templates" | — | "Birdeye alternative" | — |
| 2 | "Reply etiquette" | TCM hub | — | — |
| 3 | "4.0 threshold" | Dental hub | — | — |
| 4 | "Fake review removal" | — | "Podium alternative" | — |
| 5 | — | Salon hub | — | **State of Reviews — Q2 2026** ⭐ |
| 6 | "Velocity bands" | Restaurants hub | "Grade.us alt" | — |
| 7–12 | continue cadence | continue | continue | One major research piece per month |

**Target cadence:** 4 posts per month, all ≥ 1,500 words, all with
original data or screenshots from real audits. Quality > quantity.

---

## 5 · GEO — Generative Engine Optimization

Increasingly more important than classic SEO for high-intent queries.
ChatGPT, Perplexity, Claude, and Google AI Overviews all read the web
and answer questions. **Goal: be the most-cited source on questions
BAAM cares about.**

### 5.1 What LLMs actually pick up

- **Original data with clear citations.** "BrightLocal found 87% of consumers…" gets cited because it's specific and sourceable.
- **Q&A formatted content.** `<h2>` question, direct paragraph answer, then supporting detail.
- **Structured data** (`FAQPage`, `HowTo`, `Article` schema).
- **Author bylines with credentials.** ("By Jane Doe, former Yelp PM and BAAM Review founder.")
- **Wikipedia, Reddit, and YouTube** are over-weighted in AI training. Get cited there.

### 5.2 Concrete actions

1. **Every blog post gets an FAQ section** with `FAQPage` schema. LLMs scrape these aggressively.
2. **Lead every post with a direct answer.** Don't bury the lead — the first paragraph should *be* the answer LLMs quote.
3. **Cite primary sources by name.** "BrightLocal 2026 Local Consumer Review Survey," never "studies show." LLMs reward citation chains.
4. **Publish original research as a downloadable PDF + landing page.** These get archived and quoted because they're durable.
5. **Get a Wikipedia entry for BAAM Studio** once we have 3 independent press mentions. Tedious but disproportionately valuable.
6. **Submit our stats to data-aggregator sites** (Statista, Backlinko, HubSpot blog). Pitch "we audited N,NNN businesses and found X."
7. **Reddit presence** in `r/smallbusiness`, `r/Entrepreneur`, `r/RestaurantOwners`, `r/dentistry`. Answer questions with genuine help; link to our data when relevant. Reddit shows up heavily in ChatGPT.
8. **Test ourselves weekly.** Query 20 target questions across ChatGPT / Perplexity / Claude / Gemini, log citations. Iterate.

---

## 6 · Distribution

Each piece of content is atomized across formats:

| Content | Format | Where it goes |
|---|---|---|
| Blog post | Long-form article | baamreview.com, LinkedIn Article, Medium repost (`rel=canonical` back to BAAM) |
| Original research | PDF + landing page | Site, Reddit, occasional Hacker News, PR outreach to MarketingProfs, Marketing Brew, trade publications |
| Owner case study | Story + video | Site, YouTube, LinkedIn, Xiaohongshu (中文), TikTok |
| Audit walkthrough | 3–5 min screencast | YouTube, Instagram Reels, TikTok, Xiaohongshu |
| Quick tip | 60-sec vertical video | TikTok, IG Reels, YouTube Shorts, Xiaohongshu |
| Templated email / script | Text + downloadable | Site (gated email capture), Reddit answer (ungated) |

### 6.1 Platform-by-platform notes

**YouTube** — highest organic-discovery ROI for local-business SaaS.
Channel name = "BAAM Review." Three series:

1. *Audit Live* — record running an audit on a real (consenting) business and walking through findings
2. *Owner Stories* — case-study interviews
3. *60-second Reviews* — quick tips, repurposed to Shorts / Reels / TikTok

**Xiaohongshu (小红书)** — secret weapon for the bilingual angle.
Chinese-American business owners are heavy users. Post case studies of
Chinese-language clients, audit findings in 中文, *"如何在 Google 上获得
更多评论"* content. Almost no competitors play here.

**LinkedIn** — B2B distribution. Founder posts + company page. Best for
case studies, industry reports, and recruiting customers via DM after
they engage.

**Reddit** — slow burn but compound returns. Don't spam. Answer real
questions with substance; occasionally link data.

**Twitter / X** — lower ROI for local SaaS. Skip unless someone on the
team genuinely enjoys it. Don't waste cycles.

**TikTok / IG Reels** — atomize YouTube content here. Hook in first 2
seconds. Show before/after Google rankings on screen.

---

## 7 · Bilingual SEO (our moat)

The `/zh` route exists; most US-based competitors don't have one. Lean
in hard.

1. **Translate (don't transliterate) every pillar piece** into 简体中文. Hire one bilingual SEO writer; single highest-ROI hire.
2. **Chinese keyword research** uses Baidu Keyword Planner plus Google Search Console filtered to `country: US, language: Chinese`. Search behavior differs: "客户评价" is the common term, not "用户评论."
3. **Xiaohongshu SEO is its own platform.** First-line keywords + hashtags + image (visual platform).
4. **Local Chinese-American media:** Sing Tao Daily, World Journal (世界日报), local WeChat groups. Pitch case studies in Chinese; they'll publish more readily than mainstream press.
5. **Don't auto-translate.** Machine-translated content is penalized by Google and reads weird to Chinese readers.

---

## 8 · Measurement & KPIs

### 8.1 North-star

**Free-audit completions from organic traffic per week.** Everything
else is a supporting metric.

### 8.2 Leading indicators (weekly)

- Indexed pages (Search Console)
- Top 10 ranking keywords (Ahrefs / Semrush)
- Branded search volume ("BAAM Review")
- AI citation count (manual rubric)

### 8.3 Lagging indicators (monthly)

- Organic traffic (sessions and unique visitors)
- Audit-to-trial conversion from organic
- Backlink count + Domain Rating
- Bilingual traffic share (EN vs. ZH split)

### 8.4 Tooling decision matrix

| Tool | Purpose | When to add |
|---|---|---|
| Google Search Console | Indexing + ranking | Day 1 |
| Bing Webmaster Tools | Bing + ChatGPT discovery | Day 1 |
| Google Business Profile insights | Local-search impressions | Week 1 |
| Plausible / PostHog | On-site funnels | Day 1 (Plausible is simplest) |
| Ahrefs / Semrush | Backlinks + competitor gaps | Month 2 (after Phase 1 ships) |
| AI search testing rubric | Manual GEO citation tracking | Week 1 (use a Google Sheet) |

---

## 9 · Phasing & timeline

| Horizon | What happens | What to expect |
|---|---|---|
| Month 1–2 | Foundation: technical SEO, first 8 blog posts, GBP, 1 research report | Minimal traffic; indexing only |
| Month 3–4 | 20+ blog posts live, all pillar hubs filled, first 5 city pages, YouTube channel active | First organic traffic spike; long-tail keywords start ranking |
| Month 6 | 40+ posts, 2 research reports, 15+ city / industry pages, bilingual content published | Compound effect kicks in — typical SEO J-curve |
| Month 12 | Domain authority climbing, AI citations regular, established YouTube + Xiaohongshu channels | Organic should drive ≥ 40% of free audits |

**Honest reality check.** SEO is a 6–12 month investment. There are no
shortcuts that aren't risky. Teams that win are the ones that publish
consistently — even when month 1–2 results look depressing. Expect a
J-curve, not a hockey stick.

---

## 10 · Week 1 quick wins

Practical list, in priority order:

1. Submit sitemap to Google Search Console + Bing Webmaster Tools (30 min)
2. Add JSON-LD `Organization` schema to homepage (1 hour)
3. Set up Google Business Profile for BAAM Studio with NY address + service-area markup (30 min)
4. Verify all marketing pages have `<title>` and `<meta description>` (1 hour audit)
5. Set up an XML sitemap that auto-rebuilds on deploy — `app/sitemap.ts` (1 hour)
6. **Write the first cornerstone content:** "State of Local Reviews — Q2 2026." Pull data from existing audits. Aim for 3,000 words + 5 original charts. This becomes the citation source LLMs and journalists quote for the next 6 months. (1 week of work)
7. Launch YouTube channel with one *Audit Live* video — get the brand listed
8. Buy domain variants if unbought (baamreview.co, baamreview.ai, baamaudit.com) and 301-redirect them home
9. Add an `og:image` for social sharing — 1200×630 PNG with logo + tagline
10. Start a content calendar in a shared doc: owner, deadline, target keyword, internal links, distribution checklist per piece

---

## 11 · Recommended starting sprint (next 2 weeks)

Don't try to do everything. Pick three of the above and ship them.
Recommended trio:

1. **State-of-Local-Reviews research report** using existing audit data — this single piece is worth more than 20 generic blog posts.
2. **5 city pages** for actual NY markets with real local data — proves the programmatic-page playbook works before scaling.
3. **Technical foundation**: Search Console, GBP, JSON-LD schema, `sitemap.ts`, `robots.ts`, `hreflang` across the existing site.

That's a clean two-week sprint that sets up everything downstream.

---

## 12 · Open questions for the team

Things to decide before kicking off:

- [ ] Domain for the blog: `/blog` on baamreview.com (recommended), `blog.baamreview.com` subdomain, or separate domain? Recommendation: `/blog` for max link equity.
- [ ] Author bylines: founder voice, team voice, or a single editorial "BAAM Research" voice? Recommendation: founder voice for thought-leadership; "BAAM Research" for data reports.
- [ ] Who owns weekly content production? In-house writer, contractor, or AI-assisted founder writing? Recommendation: contractor + founder review for first 6 months.
- [ ] Budget for paid tools: Ahrefs vs. Semrush, Plausible vs. PostHog? Recommendation: Plausible + Ahrefs.
- [ ] Brand guidelines / voice — do we have a written style guide? If not, draft one before the first 5 posts ship.
- [ ] Press list: which journalists / publications do we already have warm relationships with? Cold outreach has 10× lower ROI than warm.

---

## 13 · What I (engineering) can ship without business decisions

Independent of the content decisions above, I can ship these in
priority order:

1. **`app/sitemap.ts` + `app/robots.ts`** — public, no auth, drives crawlers to every public page (~1 hour)
2. **`<JsonLd>` React component + schemas** for Organization, WebSite, Article, FAQPage, LocalBusiness, Service (~2 hours)
3. **`hreflang` tags** across `/` + `/zh` and all paired bilingual pages (~1 hour)
4. **`app/blog/[slug]/page.tsx`** — MDX-based blog infrastructure so writers can start publishing (~3 hours)
5. **`app/local/[city]/page.tsx`** — city-page template pulling live data from the audit pipeline (~4 hours, depends on what data we expose)
6. **`app/industries/[vertical]/page.tsx`** — vertical-page template (~2 hours, after blog infra is in)

Recommendation: ship 1–3 in the first day. Ship 4 when there's a draft
blog post ready. Hold 5 + 6 until we've published two pillar posts and
seen what URL structure makes sense in practice.

---

## Appendix A · Reference docs in this repo

- `docs/ARCHITECTURE.md` — code architecture (not strategy)
- `docs/BAAM_REVIEW_MASTER_PLAN.md` — product master plan
- `docs/USER_JOURNEYS.md` — onboarding + conversion paths
- `docs/Business-opportunities/` — adjacent business ideas

This SEO/GEO plan lives at `docs/SEO_GEO_PLAN.md` (this file).
