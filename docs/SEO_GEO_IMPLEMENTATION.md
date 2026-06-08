# BAAM Review · SEO + GEO Implementation Plan

**Owner:** John Tang
**Drafted:** 2026-06-06
**Companion to:** `docs/SEO_GEO_PLAN.md` (the strategy)
**Format:** 90-day rolling sprint plan with checklists

This document is the tactical rollout for the SEO/GEO strategy. The
strategy doc answers *what* and *why*. This doc answers *who does what,
in which order, by when, and how do we know it's done.*

It's written as a runbook. Open it Monday morning, check off the week's
tasks, close it. Repeat.

---

## How to use this document

- Sections **1–3** are one-time setup: read once, run the steps, archive.
- Section **4** is the rolling sprint plan: one sprint per week, ~10 hours of engineering + ~5 hours of content/ops per week.
- Section **5** is the per-content-piece production checklist: every blog post and every page goes through this.
- Section **6** is the per-page SEO QA checklist: gates before publish.
- Section **7** is the tool-setup playbook with concrete commands.
- Section **8** is the weekly review template.

If you only have 30 minutes per week, run Section 8 (the weekly review).
Everything else can shift as needed; the weekly review is the
heartbeat.

---

## 1 · Pre-flight (before any code or content)

These have to be in place before Week 1 starts. None is technical.
Allocate ~3 hours total.

### 1.1 Decisions to lock in (Section 12 of strategy doc)

Check each box once decided. Default recommendations in italics.

- [ ] Blog URL structure: *`/blog` on baamreview.com (subdirectory)*
- [ ] Author voice: *founder voice for thought-leadership; "BAAM Research" for data reports*
- [ ] Who owns weekly content: *contractor + founder review for first 6 months*
- [ ] Analytics tool: *Plausible ($9/mo) — start free trial today*
- [ ] Backlink tool: *Ahrefs Lite ($99/mo) — start month 2, not earlier*
- [ ] Email capture tool: *use existing Resend setup; no new tool*
- [ ] Newsletter platform: *defer — start with on-site signup only*

### 1.2 Accounts to create

Free, takes ~30 min each:

- [ ] Google Search Console — verify baamreview.com ownership via DNS TXT record
- [ ] Bing Webmaster Tools — verify, then import GSC settings to skip duplicate work
- [ ] Google Business Profile (BAAM Studio) — list at the company's mailing address; mark "service area business" if no public office
- [ ] YouTube channel — name "BAAM Review", verify with Google account
- [ ] LinkedIn company page — if it doesn't already exist
- [ ] Xiaohongshu account — register for Chinese-language distribution (Phase 2)

### 1.3 Assets to prepare

Won't be needed until Week 2 but easier to do now in one batch:

- [ ] 1200×630 `og:image` — logo + tagline "The review-to-revenue engine for local businesses"
- [ ] Square 512×512 brand icon for GBP, YouTube, LinkedIn
- [ ] Founder headshot for author bylines (one good photo, multiple crops)
- [ ] One-paragraph BAAM Review boilerplate description (used in schema, GBP, footer "about" blurbs)

### 1.4 Roles (single-founder reality)

| Role | Who | Hours/week initially |
|---|---|---|
| Engineering | Claude (me) + you for product decisions | ~10 |
| Content writer | Founder for first month, then contractor | ~8 |
| Content editor | Founder | ~2 |
| Distribution / ops | Founder | ~3 |
| Analytics review | Founder, weekly | ~1 |

Total: ~24 hours/week. Realistic for a solo founder with engineering help.

---

## 2 · Phase 0 sprint (Week 0 — this week)

**Goal:** unblock everything. Nothing user-facing ships this week.

| Task | Owner | Effort | Done when |
|---|---|---|---|
| Lock the 7 decisions in §1.1 | Founder | 30 min | Boxes checked above |
| Create all accounts in §1.2 | Founder | 2 hours | All verified |
| Produce assets in §1.3 | Founder | 2 hours | Files in `public/brand/` |
| Read `docs/SEO_GEO_PLAN.md` end to end | Founder | 1 hour | Done |
| Read this implementation doc end to end | Founder | 30 min | Done |
| Confirm: ready to start Week 1 | Founder | 5 min | "Yes, go" reply to engineer |

**Definition of done for Phase 0:** every checkbox in §1 is checked
*and* the founder has explicitly green-lit Week 1.

---

## 3 · Phase 1 — Foundation sprint (Week 1)

**Goal:** ship the technical baseline that lets every future content
piece carry weight. After this week, every URL we publish is indexable,
schema-tagged, sitemap-listed, and tracked.

### Week 1 backlog

Engineering (me) ships items 1–7. Founder ships items 8–12.

| # | Task | Effort | Owner | Definition of done |
|---|---|---|---|---|
| 1 | `app/sitemap.ts` enumerating all public routes | 1h | Eng | `/sitemap.xml` returns valid XML with every public URL |
| 2 | `app/robots.ts` allowing crawl, blocking `/app/*` and `/api/*` | 30m | Eng | `/robots.txt` returns valid file referencing sitemap |
| 3 | `<JsonLd>` React component | 1h | Eng | Reusable component accepting a schema object |
| 4 | Schema: `Organization` on home + about | 30m | Eng | Visible in page source; validates on schema.org validator |
| 5 | Schema: `Service` on `/audit/service` | 30m | Eng | Validates |
| 6 | Schema: `ContactPage` on `/contact` | 30m | Eng | Validates |
| 7 | `hreflang` tags between `/` and `/zh` | 1h | Eng | Both pages reference each other correctly |
| 8 | Submit sitemap to Google Search Console | 30m | Founder | URL appears in GSC + first crawl logged |
| 9 | Submit sitemap to Bing Webmaster Tools | 30m | Founder | Same in Bing |
| 10 | Set up Google Business Profile | 1h | Founder | Listing approved (Google may verify by postcard — start now, can take 7 days) |
| 11 | Install Plausible on site | 30m | Founder | Pageviews showing in dashboard within 1 hour of install |
| 12 | Create the GSC saved view for organic queries | 15m | Founder | Dashboard bookmarked |

**Week 1 total effort:** ~6 hours engineering + ~3 hours founder.

**Definition of done for Week 1:** running [Screaming Frog free tier](https://www.screamingfrog.co.uk/seo-spider/) against `baamreview.com` returns 0 critical issues, every public page has a valid `<title>` and `<meta description>`, `/sitemap.xml` validates, and schema on home + service + contact validates on schema.org.

---

## 4 · Phase 2 — Content engine kickoff (Weeks 2–6)

**Goal:** ship the first 8 blog posts, 5 city pages, 3 industry hubs,
and 1 cornerstone research report. Process repeatable by week 6.

### 4.1 Week 2 — Cornerstone report

**Single most important week of the entire 90-day plan.** Everything
downstream gets easier once this exists.

| # | Task | Effort | Owner | Done when |
|---|---|---|---|---|
| 1 | Extract aggregated audit data from Supabase (medians by vertical, regional splits) | 3h | Eng | SQL queries + CSV exports in `audit/research/q2-2026/` |
| 2 | Generate 5 charts (vertical medians, regional comparison, velocity bands, review-to-rating curve, AI-citation-by-platform) | 4h | Eng | PNG + SVG in `audit/research/q2-2026/charts/` |
| 3 | Draft the report (3,000 words) | 8h | Founder | Markdown draft committed |
| 4 | Build `/research/state-of-local-reviews-q2-2026` landing page | 2h | Eng | Page renders; report PDF downloads |
| 5 | Generate PDF from markdown + embedded charts | 1h | Eng | PDF in `public/research/` |
| 6 | Schema: `Article` + `Dataset` on the report page | 30m | Eng | Validates |

**Week 2 total:** ~14 hours engineering + ~8 hours founder. Heaviest
week; clear the calendar.

**Why this week matters:** this single report is the most-citable asset
we'll publish in 2026. Every blog post afterward links back to it,
every press pitch leans on it, every AI search citation eventually
quotes it. It compounds.

### 4.2 Week 3 — First pillar posts

Ship 3 blog posts. Process below in §5 is the per-post checklist.

- [ ] Post: "5 review-request email templates that get a 30%+ reply rate" (Pillar 1)
- [ ] Post: "What's a good Google rating for a TCM clinic? (medians by region)" (Pillar 2 + uses report data)
- [ ] Post: "Birdeye alternative for small business: an honest comparison" (Pillar 3)

Plus engineering:

- [ ] Build `app/blog/[slug]/page.tsx` MDX-based blog infrastructure (~3h)
- [ ] Build `app/industries/[vertical]/page.tsx` template (~2h)
- [ ] Build TCM industry hub at `/industries/tcm-acupuncture` (~1h)

### 4.3 Week 4 — First city pages

Ship 3 city pages with real local data + 2 more blog posts.

- [ ] Build `app/local/[city]/page.tsx` template (~3h)
- [ ] Build `/local/flushing` with real Flushing audit data (~2h, data already exists)
- [ ] Build `/local/manhattan` (~2h)
- [ ] Build `/local/middletown-ny` (~2h)
- [ ] Post: "How to ask customers for a Google review without sounding desperate"
- [ ] Post: "What's a good Google rating for a dental practice?"

### 4.4 Week 5 — Vertical hubs + 1st video

- [ ] Build `/industries/dental` hub
- [ ] Build `/industries/salon-spa` hub
- [ ] Build `/local/brooklyn`
- [ ] Build `/local/queens`
- [ ] Post: "The 4.0-star threshold and why it matters more than your total count"
- [ ] **Record + publish first YouTube *Audit Live* video** (founder, ~3h: record, edit, upload, optimize)

### 4.5 Week 6 — Comparison pillar + bilingual kickoff

- [ ] Post: "Podium alternative: what we cost vs. what they charge"
- [ ] Post: "DIY review collection (the Gmail + spreadsheet approach) vs. BAAM Review"
- [ ] Build `/zh/blog` infrastructure
- [ ] Translate (NOT auto-translate) 2 highest-traffic blog posts into Chinese
- [ ] First Xiaohongshu post: case study in 中文

**Definition of done for Phase 2 (end of Week 6):**

- 8 blog posts published, all schema-validated, all in sitemap
- 5 city pages live with real data
- 3 industry hubs live
- 1 cornerstone research report live with PDF download
- YouTube channel has 1 video, channel about page completed
- Xiaohongshu account has 1 post
- 2 Chinese-language posts published
- Plausible shows weekly traffic trend (will be small — that's fine)

---

## 5 · Per-content-piece production checklist

Every blog post and every page goes through this. Print it. Tape it to
the wall. Don't skip steps.

### 5.1 Pre-writing

- [ ] Target keyword + monthly search volume documented (use Ahrefs or Google's autocomplete)
- [ ] 3 competing top-10 results read end-to-end. We can beat them on at least one of: depth, original data, specificity, freshness
- [ ] Target word count set (1,500 / 2,500 / 3,000 — research reports skew long)
- [ ] Internal links planned: link to ≥3 other BAAM pages, ≥1 hub page
- [ ] One original data point or chart identified (mandatory — no exceptions)

### 5.2 Writing

- [ ] First paragraph is the answer LLMs would quote (TL;DR-style — see §5 of strategy doc)
- [ ] At least 5 `<h2>` sections, all phrased as questions where possible
- [ ] FAQ section at the bottom with 5–8 questions
- [ ] Author byline + 1-sentence bio with credentials
- [ ] All claims cited inline with named primary sources

### 5.3 Pre-publish

- [ ] `<title>` ≤ 60 chars, includes target keyword
- [ ] `<meta description>` ≤ 155 chars, click-worthy
- [ ] `<link rel="canonical">` self-references
- [ ] `og:image` set (use template or custom for cornerstone pieces)
- [ ] JSON-LD: `Article` + `FAQPage` (where applicable) — validates on schema.org
- [ ] Run page through Lighthouse — fix anything that breaks 90+ Performance / 95+ SEO
- [ ] Run page through [validator.schema.org](https://validator.schema.org/) — 0 errors
- [ ] Read aloud — if it sounds robotic, rewrite

### 5.4 Post-publish (within 24 hours)

- [ ] Submit URL via Google Search Console "Inspect URL → Request indexing"
- [ ] Submit URL via IndexNow API (one POST to `https://api.indexnow.org/indexnow`)
- [ ] Internal link added from at least 1 existing related post (and the relevant hub)
- [ ] Excerpt cross-posted to LinkedIn (founder voice)
- [ ] Excerpt + image cross-posted to Reddit if it answers a frequently-asked question (no spammy "check out my blog" — answer the question, link as source)
- [ ] If video-worthy: outline shot list for YouTube video version

### 5.5 1-week post-publish review

- [ ] Check GSC for impressions on the target keyword
- [ ] Check Plausible for entry pageviews
- [ ] Add to AI citation tracker (Section 8.3)
- [ ] Decide: needs follow-up post, needs internal link from older content, or shelve and move on

---

## 6 · Per-page SEO QA checklist (engineering)

Gate before merging any new page route. ~5 min per page.

```
[ ] <title> present, ≤60 chars, includes target keyword
[ ] <meta name="description"> present, ≤155 chars
[ ] <link rel="canonical"> present, self-referencing
[ ] <meta property="og:title">, og:description, og:image present
[ ] <meta name="twitter:card" content="summary_large_image"> present
[ ] hreflang tags (if page has /zh equivalent)
[ ] JSON-LD schema present and validates
[ ] No <h1> duplication (exactly one per page)
[ ] All images have descriptive alt text
[ ] All internal links use relative paths (not full URLs)
[ ] Lighthouse mobile Performance ≥ 80, SEO ≥ 95
[ ] Page renders without JavaScript (server-rendered or static)
[ ] Page is in app/sitemap.ts (or will be auto-included by route detection)
```

---

## 7 · Tool-setup playbook

Concrete steps with actual commands. Run each section once.

### 7.1 Google Search Console

1. Go to <https://search.google.com/search-console>
2. Add property → URL prefix → `https://baamreview.com`
3. Verify via DNS TXT record (Cloudflare or wherever DNS lives)
4. Submit sitemap at Settings → Sitemaps → `https://baamreview.com/sitemap.xml`
5. Bookmark the "Performance" view filtered to Last 28 days

### 7.2 Bing Webmaster Tools

1. Go to <https://www.bing.com/webmasters/>
2. Add site → "Import from Google Search Console" (saves duplicate verification)
3. Submit sitemap
4. Generate an IndexNow API key on the dashboard
5. Add API key to BAAM's `.env.local` as `INDEXNOW_KEY=...`
6. Engineering creates the `/api/indexnow/[slug].txt` route to satisfy IndexNow's key-file requirement

### 7.3 Google Business Profile

1. Go to <https://business.google.com>
2. Add business → "BAAM Studio" (parent brand) or "BAAM Review" (if you want to brand-anchor to the product)
3. Category: "Software company" (primary) + "Marketing agency" (secondary)
4. Service area: New York metro initially; add cities as we expand
5. Hours: "Mon–Fri 9am–6pm Eastern"
6. Verification: Google will send a postcard with a code (5–7 business days). Submit code when it arrives.
7. Once verified, post weekly "Updates" — these are dead simple SEO wins for local queries.

### 7.4 Plausible Analytics

1. Sign up at <https://plausible.io> — $9/mo for 10k pageviews
2. Add domain `baamreview.com`
3. Engineering adds the `<Script>` to `app/layout.tsx` root
4. Verify pageviews show in dashboard

### 7.5 IndexNow (auto-submit new URLs)

After Bing setup gives an API key:

1. Engineering creates `lib/seo/indexnow.ts` helper:
   ```ts
   export async function pingIndexNow(urls: string[]) {
     await fetch("https://api.indexnow.org/indexnow", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         host: "baamreview.com",
         key: process.env.INDEXNOW_KEY,
         keyLocation: `https://baamreview.com/${process.env.INDEXNOW_KEY}.txt`,
         urlList: urls,
       }),
     });
   }
   ```
2. Call `pingIndexNow([newUrl])` from the blog publish flow
3. Now Bing + ChatGPT (via Bing index) discover content within seconds, not hours

---

## 8 · Weekly review template (every Monday, 30 min)

This is the heartbeat. If everything else slips, this stays.

### 8.1 Numbers to log

| Metric | Source | Last week | This week | Δ |
|---|---|---|---|---|
| Indexed pages | GSC → Coverage | _ | _ | _ |
| Total organic clicks | GSC → Performance | _ | _ | _ |
| Top query (impressions) | GSC | _ | _ | _ |
| Top query (clicks) | GSC | _ | _ | _ |
| Total pageviews | Plausible | _ | _ | _ |
| Free audits started from organic | Plausible funnel | _ | _ | _ |
| Free audits completed from organic | Plausible funnel | _ | _ | _ |
| Posts published | Tally | _ | _ | _ |
| AI citations (manual count) | §8.3 below | _ | _ | _ |

Log into a Google Sheet, append a row per week. After 12 weeks, the
trend will be obvious.

### 8.2 Decisions to make

- Which post this week underperformed expectations? Why? (one sentence)
- Which post overperformed? Can we double down on the topic?
- Any keyword in GSC where we rank #4–10? That's the highest-leverage place to improve — fixing internal links + adding 200 words often pushes top-10 to top-3.

### 8.3 AI citation rubric (manual, ~10 min)

Each week, ask the same 10 questions across ChatGPT / Perplexity /
Claude / Google AI Overviews. Log whether BAAM Review is cited.

| Question | ChatGPT | Perplexity | Claude | Gemini |
|---|---|---|---|---|
| "Birdeye alternative for small business" | _ | _ | _ | _ |
| "How to get more Google reviews for a dental practice" | _ | _ | _ | _ |
| "What's a good Google rating for a TCM clinic" | _ | _ | _ | _ |
| "Review marketing for salons" | _ | _ | _ | _ |
| "Per-review dollar value" | _ | _ | _ | _ |
| "How often should I reply to Google reviews" | _ | _ | _ | _ |
| "Best review management tool for bilingual businesses" | _ | _ | _ | _ |
| "Why 4.0 stars matters more than total review count" | _ | _ | _ | _ |
| "Local SEO review velocity bands" | _ | _ | _ | _ |
| "AI search and Google reviews" | _ | _ | _ | _ |

Mark cell ✓ if BAAM is cited by name or linked. Trend matters more than
absolute number. Goal: ≥ 3 ✓ within 3 months, ≥ 10 within 6 months.

---

## 9 · Sprint plan summary (12 weeks at a glance)

| Week | Theme | Output | Hours |
|---|---|---|---|
| 0 | Pre-flight | Decisions + accounts + assets | 6 |
| 1 | Foundation | sitemap, robots, schema, hreflang, GSC, Plausible, GBP | 9 |
| 2 | Cornerstone | State of Local Reviews Q2 report | 22 |
| 3 | First pillars | 3 blog posts + blog infra + TCM hub | 18 |
| 4 | City pages | City template + 3 city pages + 2 posts | 18 |
| 5 | Vertical + video | 2 more hubs + 2 cities + 1 post + 1st YouTube | 18 |
| 6 | Comparison + 中文 | 2 comparison posts + bilingual kickoff + 1st Xiaohongshu | 16 |
| 7 | Distribution audit | Press list + Reddit warmup + LinkedIn cadence | 12 |
| 8 | Second cornerstone | Velocity Decay research report | 22 |
| 9 | Long tail | 4 posts targeting specific city+vertical combos | 16 |
| 10 | Bilingual depth | 4 more translated posts + 2 Xiaohongshu | 14 |
| 11 | Backlink push | Pitch research reports to journalists + trade pubs | 14 |
| 12 | Review + replan | Look at 90 days of data, replan Q4 | 8 |

**Total ~190 hours over 12 weeks** = ~16 hrs/week split across
engineering + content + ops. Realistic for solo founder with my help.

---

## 10 · Definition of done (90-day mark)

By end of Week 12, the following should be true:

- [ ] 16+ blog posts published
- [ ] 8+ city pages live with real local data
- [ ] 6+ industry hub pages
- [ ] 2 cornerstone research reports with PDFs
- [ ] YouTube channel with 4+ videos
- [ ] Xiaohongshu account with 6+ posts
- [ ] 6+ Chinese-language blog posts
- [ ] GSC showing impressions on 50+ unique queries
- [ ] At least 3 AI citation ✓ marks across the rubric
- [ ] Plausible showing 4×+ growth in organic sessions vs. Week 1 (low base — easy)
- [ ] At least 5 backlinks from external domains
- [ ] Weekly review cadence established and not skipped

If 8 of these 11 are true, the engine is working. Replan Q4 with full
confidence.

---

## 11 · Budget estimate (90 days)

| Item | One-time | Monthly | 90-day total |
|---|---|---|---|
| Plausible Analytics | — | $9 | $27 |
| Ahrefs Lite (start month 2) | — | $99 | $198 |
| Domain variants (if needed) | $50 | — | $50 |
| Stock photos (if not using own) | — | $30 (Unsplash+) | $90 |
| Contractor writer (start month 2) | — | $1,500 | $3,000 |
| Press distribution (Help A Reporter / Qwoted) | — | $50 | $100 |
| YouTube editing tools (Descript) | — | $24 | $72 |
| **Total cash** | **$50** | **~$1,712** | **~$3,537** |

Plus founder time: ~80 hours over 12 weeks. Plus engineering time:
~110 hours over 12 weeks.

Compare to running a Google Ads campaign at the same conversion: $3,500
buys roughly 70 audit signups at $50/lead. The SEO investment should
produce 3–5× that over 12 months — but takes 6–9 months to start
showing.

---

## 12 · Risk register

What could derail this plan, and how to handle it.

| Risk | Likelihood | Mitigation |
|---|---|---|
| Founder runs out of writing time after Week 4 | High | Hire contractor at Week 4, not Week 8 |
| Cornerstone report data is thinner than expected | Medium | Pre-check data availability in Week 0 SQL queries |
| Google indexes slowly (first ranks take 8+ weeks) | High | Expected — don't panic. Indexing ≠ ranking. Trust the J-curve. |
| AI citation rubric shows zero progress at week 6 | Medium | Normal. AI ingestion lags by months. Persist. |
| One blog post goes viral and overshadows the plan | Low | Pleasant problem. Double down on that topic. |
| Birdeye / Podium publishes counter-content | Low | They probably won't notice us for a year. Use the runway. |
| Search Console verification fails | Low | Have backup verification method (HTML file upload) ready |
| Bilingual writer is unaffordable | Medium | Translate top 2 posts manually before hiring; defer broader bilingual push to month 4 |

---

## 13 · Engineering deliverables — concrete next 7 days

What I can ship without further input. Listed in build order.

### Day 1 (today, ~3 hours)

- [ ] `app/sitemap.ts` enumerating all known public routes
- [ ] `app/robots.ts` allowing crawl, blocking app/api/auth
- [ ] `components/seo/JsonLd.tsx` — reusable schema component
- [ ] `lib/seo/schemas.ts` — pre-built Organization, WebSite, LocalBusiness, Service, Article, FAQPage helpers

### Day 2 (~2 hours)

- [ ] Mount `<JsonLd>` for `Organization` on `app/page.tsx`
- [ ] Mount `Service` schema on `app/audit/service/page.tsx`
- [ ] Mount `ContactPage` on `app/contact/page.tsx`
- [ ] Add `hreflang` between `/` and `/zh`

### Day 3 (~3 hours)

- [ ] `app/blog/[slug]/page.tsx` MDX-based blog infrastructure
- [ ] `app/blog/page.tsx` blog index
- [ ] `content/blog/_template.mdx` — boilerplate for first post
- [ ] Wire blog routes into sitemap auto-discovery

### Day 4 (~2 hours)

- [ ] `app/local/[city]/page.tsx` city-page template
- [ ] Helper: `lib/audit/research/city-stats.ts` — pulls aggregated stats for one city
- [ ] Wire local routes into sitemap

### Day 5 (~2 hours)

- [ ] `app/industries/[vertical]/page.tsx` vertical-hub template
- [ ] IndexNow integration: `lib/seo/indexnow.ts` + auto-ping on publish

### Day 6–7 (founder)

- Founder completes Section 1 + Section 2 of this doc

**Definition of done for Engineering Week 1:** all routes deploy
successfully, all schema validates, `/sitemap.xml` returns ≥ 15 URLs,
Lighthouse SEO score ≥ 95 on home + about + contact + service.

---

## 14 · Status tracking

This document lives at `docs/SEO_GEO_IMPLEMENTATION.md`. Check
boxes inline as items complete. Commit the file weekly so progress is
version-controlled.

Companion docs:
- `docs/SEO_GEO_PLAN.md` — strategy (the *what* and *why*)
- This doc — implementation (the *when*, *who*, *how*)

When Q3 rolls around, fork this doc to `SEO_GEO_IMPLEMENTATION_Q3.md`
and replan from §9 onward.
