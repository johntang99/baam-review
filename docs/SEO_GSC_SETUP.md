# BAAM Review · GSC + SEO Tools Setup Guide

**Owner:** John Tang
**Companion to:** `SEO_GEO_PLAN.md` (strategy) and `SEO_GEO_IMPLEMENTATION.md` (sprint runbook)
**Estimated time:** 60–90 minutes end-to-end

Step-by-step instructions for setting up Google Search Console and the
related SEO tools so the engineering work we shipped (sitemap, schema,
hreflang, robots) actually starts driving organic traffic.

**Prerequisite — confirm before starting:**
- [ ] `https://baamreview.com/sitemap.xml` returns a styled XML table (not a 404). Hard-refresh first.
- [ ] `https://baamreview.com/robots.txt` returns the disallow rules + a `Sitemap:` line.
- [ ] You have DNS access for `baamreview.com` (or are willing to verify via HTML file / meta tag instead).

---

## Section 1 · Google Search Console (GSC) — primary setup

**Why it matters:** GSC is the single most important free SEO tool. It
tells you what queries you rank for, which pages get clicks, indexing
errors, and Core Web Vitals. Without GSC you're flying blind.

**Time:** 15 minutes (most of it waiting for verification to propagate).

### Step 1.1 · Add the property

1. Go to **https://search.google.com/search-console**
2. Sign in with your Google account (use a long-term account — not a
   personal one you might lose access to)
3. Click **"+ Add property"** (top-left dropdown if you have other properties)
4. Choose **"URL prefix"** (NOT Domain — Domain requires DNS verification only, URL prefix gives you more options)
5. Enter exactly: `https://baamreview.com`
6. Click **Continue**

### Step 1.2 · Verify ownership

GSC offers 5 methods. **Pick HTML meta tag** — it's the fastest and survives DNS changes.

1. In the verification screen, expand **"HTML tag"**
2. Copy the meta tag — it looks like:
   ```html
   <meta name="google-site-verification" content="abc123..." />
   ```
3. **Tell me the `content="..."` string** — I'll add it to `app/layout.tsx` so it ships on every page. Or do it yourself by editing the metadata object in the root layout:
   ```ts
   export const metadata: Metadata = {
     // ... existing fields
     verification: {
       google: "abc123...", // the content string only, NOT the full tag
     },
   };
   ```
4. After commit + push + Vercel deploy (~2 min), return to GSC and click **Verify**
5. Verification should succeed within seconds

**If verification fails:** Wait 5 min for CDN to propagate the new meta tag, hard-refresh `view-source:https://baamreview.com/`, confirm the meta tag is in the `<head>`, then retry.

### Step 1.3 · Submit the sitemap

1. In GSC left nav → **Sitemaps**
2. Under "Add a new sitemap," enter just: `sitemap.xml` (GSC prepends the domain)
3. Click **Submit**
4. Status should flip to "Success" within 1–2 minutes

**What to check after submission:**
- "Discovered URLs" count should match the number of URLs in your sitemap (~17 + blog posts + city pages)
- "Last read" timestamp should be recent

### Step 1.4 · Set up the saved views you'll actually use

GSC's UI is dense. Bookmark these specific URLs so you don't waste time clicking:

1. **Performance (queries, Last 28 days)**:
   `https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fbaamreview.com&num_of_days=28`

2. **Index coverage** (which pages Google indexed vs. excluded):
   `https://search.google.com/search-console/index/coverage?resource_id=https%3A%2F%2Fbaamreview.com`

3. **URL Inspection** (test any specific URL):
   Top search box on any GSC page. Paste any URL → see exactly what Google sees.

### Step 1.5 · Verify a sample page

Use URL Inspection to confirm everything we shipped actually works:

1. Paste `https://baamreview.com/about` into the top search box
2. Click **"Test live URL"** (top right)
3. Wait 30–60s for the test
4. Click **"View tested page"** → **"More info"** → confirm:
   - **HTML response** is 200 OK
   - **Page resources** all loaded (no blocked CSS / fonts)
   - **JavaScript console messages** show no errors
   - In the **HTML** tab, search for `application/ld+json` → confirm our JSON-LD schema is there

If anything's red here, fix it before submitting to crawl. Most likely culprits: missing OG image, malformed schema (paste the JSON-LD into https://validator.schema.org/ to diagnose).

### Step 1.6 · Request indexing for high-priority pages

Don't wait for Google's natural crawl cycle for your most important pages:

1. URL Inspection → paste each of these one at a time, click **"Request indexing"**:
   - `https://baamreview.com/`
   - `https://baamreview.com/about`
   - `https://baamreview.com/case-studies`
   - `https://baamreview.com/audit/service`
   - `https://baamreview.com/audit`
   - `https://baamreview.com/local/flushing`
   - `https://baamreview.com/local/manhattan`

2. Each request takes ~30s and pushes that URL to the front of Google's crawl queue. **Max 10 per day** — they rate-limit.

3. Pages typically appear in search within 24–48 hours after a successful index request.

### What to check daily (first 2 weeks)

- [ ] **Coverage** report: any "Errors" or "Excluded" pages? Fix immediately.
- [ ] **Performance**: impressions slowly climbing? Normal — patience.
- [ ] **Schema enhancements** (LH nav): if Google detected your schema, you'll see "FAQ" / "Article" / "Breadcrumb" reports appear over time.

---

## Section 2 · Bing Webmaster Tools (BWT)

**Why it matters:** Bing's index also powers **ChatGPT search, Copilot, and DuckDuckGo**. Skipping this is leaving AI traffic on the table.

**Time:** 5 minutes.

### Step 2.1 · Set up

1. Go to **https://www.bing.com/webmasters/**
2. Sign in (Microsoft or Google account both work)
3. Click **"+ Add site"** → **"Import sites from Google Search Console"** (saves you from re-verifying)
4. Authorize the import — Bing pulls baamreview.com + verification automatically
5. Submit sitemap if not auto-imported: `https://baamreview.com/sitemap.xml`

### Step 2.2 · Generate IndexNow key (for later)

While you're in BWT:

1. Bottom-left nav → **IndexNow** → **API key**
2. Click **Generate** — you'll get a long random string
3. Copy it. We need it for the next section.

---

## Section 3 · IndexNow activation (instant Bing/ChatGPT indexing)

**Why it matters:** Without IndexNow, Bing finds new blog posts whenever it next crawls (~hours to days). With IndexNow, you can ping Bing the moment you publish and it picks up the URL **within minutes**. Same for ChatGPT, which uses Bing's index.

**Time:** 5 minutes.

### Step 3.1 · Add the env var

1. Open your **Vercel project dashboard** → Settings → Environment Variables
2. Add a new variable:
   - Name: `INDEXNOW_KEY`
   - Value: the long random key you got from BWT in Step 2.2 (or generate one with `openssl rand -hex 16`)
   - Apply to: **Production** (and Preview if you want to test there too)
3. Click **Save**
4. **Important:** Vercel only applies env var changes to new deployments. Trigger a redeploy:
   - Vercel dashboard → Deployments → top deployment → **⋯** menu → **Redeploy**
   - Or push any commit to trigger a fresh build

### Step 3.2 · Verify the key is served

After redeploy completes (~2 min):

1. Visit `https://baamreview.com/<YOUR-KEY>.txt` (replace with the actual key)
2. Should return the key as plain text — that's how IndexNow verifies ownership

If 404: the env var didn't apply. Check Vercel deployment logs.

### Step 3.3 · Test a manual ping

You can manually ping a URL via this curl:

```bash
curl -X POST https://api.indexnow.org/indexnow \
  -H "Content-Type: application/json" \
  -d '{
    "host": "baamreview.com",
    "key": "YOUR-KEY",
    "keyLocation": "https://baamreview.com/YOUR-KEY.txt",
    "urlList": ["https://baamreview.com/"]
  }'
```

Expected: HTTP 200 with no body. That's success.

### Step 3.4 · Wire auto-ping on publish (optional, not yet built)

Right now publishing from `/admin` doesn't auto-ping IndexNow. To wire it, I'd modify `lib/admin/content.ts` so `onContentMutation()` calls `pingIndexNowForPath()` for the affected URL. ~5 min of work — tell me when you want it.

---

## Section 4 · Google Business Profile (GBP)

**Why it matters:** GBP is what makes BAAM Studio show up in Google Maps and the Local Pack ("near me" results). Even though we're a software company, a verified GBP gives us a +5-10% boost on branded searches and lets us collect reviews.

**Time:** 10 minutes setup; verification by postcard takes 5–7 days to arrive.

### Step 4.1 · Create the listing

1. Go to **https://business.google.com**
2. Click **"Manage now"** → search for "BAAM Studio" or "BAAM Review"
3. If it doesn't exist (likely), click **"Add your business to Google"**
4. **Business name:** `BAAM Review` (the product brand is more searched than BAAM Studio)
5. **Business category:** Primary = "Software company" or "Internet marketing service"; you can add a secondary like "Marketing agency"
6. **Location:**
   - If you have a public-facing office: enter the address
   - If not (most likely): check **"I deliver goods and services to my customers"** and add service areas like "New York, NY," "Brooklyn, NY," "Queens, NY," "Manhattan, NY," "Long Island, NY"
7. **Contact info:**
   - Phone (use a Google Voice number if you want it separate)
   - Website: `https://baamreview.com`
8. **Hours:** Mon–Fri 9am–6pm Eastern

### Step 4.2 · Verify

Google sends a postcard with a verification code to the address you registered. Takes 5–7 business days. Enter the code in the GBP dashboard when it arrives.

### Step 4.3 · Optimize after verification

Once verified:
- Add 5–10 photos (logo, hero shot from website, screenshot of audit report)
- Write the "From the business" description (~750 chars) — emphasize bilingual capability + local-business focus
- Post weekly "Updates" — short blurbs about new blog posts, case studies, audits run. **Each post is a small SEO signal** for local search.

---

## Section 5 · Plausible Analytics (on-site funnel tracking)

**Why it matters:** GSC tells you what search queries land people on your site. Plausible tells you what they DO once they're there. Both are necessary.

**Time:** 10 minutes.

### Step 5.1 · Sign up

1. Go to **https://plausible.io** → start 30-day free trial
2. Add domain: `baamreview.com`
3. Plausible gives you a `<script>` tag to install. Copy it.

### Step 5.2 · Install in Next.js

I haven't wired this yet — when you're ready, tell me your Plausible domain (usually just `baamreview.com`) and I'll add the script tag to `app/layout.tsx` so it tracks every page automatically. ~5 min of work.

### Step 5.3 · Set up the goals you actually care about

After install, in the Plausible dashboard:
1. Settings → Goals → **"+ Add goal"**
2. Add these as **Pageview goals**:
   - `/audit/new` (audit form viewed)
   - `/audit/list` (audit completed — user landed on results)
3. After 1–2 weeks of data, you'll see conversion rates per source (organic, direct, social, referral).

---

## Section 6 · Schema validation — verify what we shipped

**Why it matters:** Our JSON-LD schema is invisible to humans but critical for Google rich results and AI search citations. One typo and the whole schema is invalid.

**Time:** 5 minutes.

### Step 6.1 · Run pages through the validator

1. Go to **https://validator.schema.org/**
2. Paste these URLs one at a time and confirm zero errors:
   - `https://baamreview.com/`
   - `https://baamreview.com/about`
   - `https://baamreview.com/case-studies`
   - `https://baamreview.com/contact`
   - `https://baamreview.com/audit/service`
   - `https://baamreview.com/local/flushing`
3. Look for `Organization`, `WebSite`, `Service`, `LocalBusiness`, etc. — each should validate green.

### Step 6.2 · Google Rich Results Test

The validator above is generic schema.org. For Google-specific rich-result eligibility:

1. Go to **https://search.google.com/test/rich-results**
2. Same URLs as above
3. This shows which **rich results** Google can show for your pages (FAQ snippets, breadcrumbs, etc.).

If a page is missing a rich-result it should have, the test tells you exactly which schema field is required. Often a one-line fix.

---

## Section 7 · AI search citation tracking (manual rubric)

**Why it matters:** Per the strategy doc, AI search is now as important as classic SEO. There's no GSC equivalent for ChatGPT — you have to manually check.

**Time:** 15 minutes per week, ongoing.

### Step 7.1 · Build the tracker sheet

Create a Google Sheet with this structure:

| Question | ChatGPT | Perplexity | Claude | Gemini | Week of |
|---|---|---|---|---|---|
| "Birdeye alternative for small business" | | | | | 2026-06-09 |
| "How to get more Google reviews for dental practice" | | | | | |
| "Review marketing for TCM clinics" | | | | | |
| "What's a good Google rating for a dental practice" | | | | | |
| "How often should I reply to Google reviews" | | | | | |
| "Per-review dollar value" | | | | | |
| "Best review tool for bilingual businesses" | | | | | |
| "Local SEO review velocity" | | | | | |
| "AI search and Google reviews" | | | | | |
| "Free Google review audit" | | | | | |

### Step 7.2 · Run the rubric weekly

Every Monday morning, ~15 min:

1. Open each of the 4 AI tools in incognito (signed-out, no personalization)
2. Paste each question one at a time
3. Mark cell ✓ if BAAM Review is cited / linked / mentioned by name
4. Mark ? if a related domain (BAAM Studio, our blog post URL) was cited but not the brand
5. Mark ✗ if no mention

### Step 7.3 · Targets

- **Month 1:** 0 ✓ marks expected. AI search has slow ingestion.
- **Month 3:** ≥3 ✓ across the rubric.
- **Month 6:** ≥10 ✓.
- **Year 1:** BAAM cited on every question that's specifically about review marketing for bilingual / local businesses.

The ratchet up only happens if we keep publishing fresh content + research reports. AI search rewards consistency.

---

## Section 8 · What to do after the tools are set up

Per the implementation runbook's sprint plan, the tool setup IS Week 1. Once it's done, the next big lever is **content**, specifically:

1. **Cornerstone research report** — "State of Local Reviews — Q2 2026" using data from your audit pipeline. This single piece is more valuable than 20 generic blog posts. Plan is in `SEO_GEO_IMPLEMENTATION.md` § 4.1.
2. **First 3 blog posts** per the content calendar in `SEO_GEO_PLAN.md` § 4.5.
3. **Publish from `/admin/blog`** — the admin is built and live.

Tell me when you want to scaffold the research report or kick off the first blog post and I'll wire it up.

---

## Quick-reference checklist

Use this list to track completion. Each item links to the section above.

- [ ] **1.1** GSC: property added (https://baamreview.com)
- [ ] **1.2** GSC: ownership verified (HTML meta tag in app/layout.tsx)
- [ ] **1.3** GSC: sitemap submitted
- [ ] **1.5** GSC: sample page passes URL Inspection live test
- [ ] **1.6** GSC: indexing requested for top 7 pages
- [ ] **2.1** Bing Webmaster Tools: site imported from GSC
- [ ] **2.2** Bing: IndexNow API key generated
- [ ] **3.1** Vercel: `INDEXNOW_KEY` env var added + redeployed
- [ ] **3.2** IndexNow: key file at `/<KEY>.txt` returns the key
- [ ] **3.3** IndexNow: manual ping test returns 200
- [ ] **4.1** GBP: listing created
- [ ] **4.2** GBP: postcard verification submitted (wait 5–7 days)
- [ ] **5.1** Plausible: account + domain created
- [ ] **5.2** Plausible: script installed (tell engineer)
- [ ] **5.3** Plausible: goals set up
- [ ] **6.1** Schema validator: all 6 pages return zero errors
- [ ] **6.2** Google Rich Results Test: all 6 pages eligible for the rich results we expect
- [ ] **7.1** AI citation tracker: Google Sheet built
- [ ] **7.2** AI citation: baseline rubric run

When all of Section 1–6 are checked, you're done with the SEO foundation. Section 7 is ongoing. Section 8 is what makes traffic actually grow.
