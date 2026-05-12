# BAAM Review — Compound Stage Addendum

**Version:** 2.0 — Premium Design
**Date:** May 12, 2026
**Status:** Approved for v1.7 build (Sessions 33–40)
**Supersedes:** Master Plan §3.7, §8.7, §13.7 (Stage 7 sections) — those sections remain valid but this document is the canonical spec for the four Compound features.

---

## Why this document exists

The master plan named Stage 7 (Compound) and allocated v1.7 sessions to it, but only sketched the features at one paragraph each. This addendum upgrades Stage 7 from "feature list" to a fully-designed, build-ready premium specification:

1. **Themes Dashboard** — expanded UX, cross-language clustering, premium editorial visual treatment
2. **AI Ad-Copy Generator** — four-platform output with source attribution
3. **Auto-Published Testimonial Pages** — 60-day cadence, customer-domain embed, full Schema.org markup
4. **NEW: Review-to-Content Pipeline** — turns each high-signal review into six platform-native video formats in one render pass, distributable to YouTube Shorts, YouTube long-form, TikTok, Instagram Reels, Xiaohongshu, GBP video posts, and website hero loops

The video feature gets the deepest design treatment because it's the most differentiated and the highest-leverage retention lever in the entire product. The other three features are critical, but their patterns are well-understood. The video pipeline is genuinely novel and deserves the design depth.

**Timing:** All Stage 7 features are v1.7 — Sessions 33–40, ~6 months after v1 launch. Don't accelerate. Compound features require a base of accumulated reviews to produce quality output; a newly-onboarded customer has no source material yet.

---

## Strategic framing — the positioning shift

Before any feature design: **how this is named matters as much as how it's built.**

**Wrong framing — "AI video generator":**
Invites comparison to Sora, Runway, Pika, HeyGen. All of those exist standalone at $20-50/month. An SMB owner who's heard the AI hype assumes BAAM is offering a worse version of those tools bundled with a review collector. BAAM cannot win that comparison on raw generation quality.

**Right framing — "Review-to-Content Pipeline":**
Invites no comparison because nothing else does this. The pipeline starts from real customer reviews (which BAAM is uniquely positioned to collect) and ends at platform-native content in six formats. The competition isn't Sora — the competition is "the SMB owner doing nothing because manual editing takes too long."

Two consequences for the rest of this document:

1. The feature is called **Review Studio** in product copy, never "AI video generator." Inside the product, the surface is `/dashboard/studio`.
2. The marketing positioning leads with format diversity, not generation quality. "One review becomes six pieces of platform-native content" is the headline, not "AI generates videos."

This isn't a small framing choice. It's the difference between being a commodity AI tool and being defensible market infrastructure.

---

## Why Compound is the long-term moat

The Collect → Refer stages (1–6) get a customer reviews and turn some into referrals. Stage 7 turns the *accumulated review data* into ongoing assets — ad copy, SEO pages, social videos — that work without further customer interaction.

This matters for three reasons:

1. **Anti-churn after month 6.** A customer with 80 accumulated reviews has 80 themes' worth of marketing material BAAM is generating for them passively. Leaving means losing 6 months of compound advantage. This is what justifies retention at month 12+.

2. **Defensibility against well-funded competitors.** Birdeye, Podium, NiceJob all collect reviews. None mine the review corpus to auto-generate marketing assets in three languages with six platform formats. The Compound stage is where BAAM stops being "a review tool" and becomes "the SMB's marketing automation layer."

3. **GBP video posts are a quiet 2026 SEO advantage.** Google has been weighting GBP video content heavily in Local Pack rankings since early 2025, and ~zero local SMB competitors are posting them — because creating them by hand is too much work. BAAM's auto-generated GBP-compliant videos are a real ranking advantage you can market.

Both retention and SEO arguments justify shipping Compound thoroughly even though it lands last. A half-built Compound is worse than no Compound — the promise raises expectations.

---

## Feature 1 — Themes Dashboard

### Activation and threshold

Available at `/dashboard/themes` once a location has accumulated **≥ 30 reviews** across `imported_reviews` + `first_party_reviews`. Below 30, the page renders an empty state explaining the threshold ("Themes appear after 30+ reviews so the patterns are real, not noise") with a count of reviews collected so far.

The 30-review floor is non-negotiable. Below it, theme mining produces noise — single-mention themes that look like patterns but aren't. Better to wait than to surface noise.

### The premium editorial treatment

The Themes Dashboard should feel like the analytics page of a literary magazine, not a SaaS dashboard. Concrete design choices:

**Page header:**
- Fraunces serif, weight 400, 48px, "What your customers are saying"
- Newsreader italic sub-line: "Themes mined nightly from your reviews. Last updated 6 hours ago."
- The "last updated" timestamp is critical — it tells the owner this is alive, not static.

**Top themes layout:**
A two-column grid, not a list. Each theme is a card with substantial breathing room. Card structure:

```
┌──────────────────────────────────────────┐
│  ↑ 32%   patient explanations            │  ← trend arrow + theme name
│                                          │
│  Mentioned 47 times in the last 90 days  │  ← context line
│                                          │
│  "She takes her time, explains every     │  ← Newsreader italic
│   step, and never makes you feel rushed."│     pull-quote
│   — Marcus D. · 5★                       │
│                                          │
│  "黄医生很有耐心，每一步都解释得很清楚"   │  ← second quote, different lang
│   — Sarah L. · 5★                        │
│                                          │
│  ──────                                  │
│                                          │
│  [Generate ads] [Generate page]          │  ← action buttons
│  [Generate video] [See all 47 reviews →] │
│                                          │
└──────────────────────────────────────────┘
```

The cards alternate background — paper / cream-deep — to break up the page rhythm. Each card has hover state that lifts it 4px and adds a soft shadow.

**Sort options (pill row at top):**
- Most mentioned (default)
- Fastest growing (highest delta vs. previous 90 days)
- Highest-rated (themes appearing in 5★ reviews specifically)
- By language (filter to themes in EN, 中文, ES)

**Trend chart below the grid:**
A single `recharts` line chart showing the top 5 themes' mention frequency over the trailing 12 months. Hover any line to highlight; legend lets owner toggle themes on/off. This reveals which themes are growing (a TCM clinic seeing "telehealth" surge during flu season) vs. fading.

### Cross-language theme clustering

The mining prompt explicitly clusters themes across languages. "细心" in Chinese reviews, "attentive" in English reviews, and "atento" in Spanish reviews are the same theme. The theme card displays its name in the location's primary language but shows example quotes in the original language of each source review.

This is the multilingual moat made operational. Every other review tool treats languages as silos. BAAM treats them as one corpus with cross-language insight.

### Theme detail view

Clicking through `[See all 47 reviews →]` opens `/dashboard/themes/[theme_id]`:

- Full list of all reviews mentioning the theme, paginated 20 per page
- Distribution panels showing rating breakdown, language breakdown, monthly trend
- Source attribution: which keywords/phrases earned a review its theme tag (helps the owner trust the mining)
- "Use in marketing" sticky bar with the same four action buttons
- A small "Suggest renaming" link in case the auto-generated theme name doesn't fit the business's preferred vocabulary

### Mining mechanics

A scheduled job (`/api/cron/mine-themes`) runs nightly per location with ≥30 reviews:

1. Pulls all reviews from the trailing 90 days
2. Sends batches of 50 to Claude Sonnet 4.6 with the **theme mining prompt** (Appendix A)
3. Receives structured JSON of `{ theme_name, theme_description, example_review_ids, supporting_quotes, estimated_strength }`
4. Compares against existing `review_themes` rows
5. Increments counts, adds new themes, marks themes with no mentions in 90 days as `archived`

**Cost per location per month:** ~$2.40 (80 reviews × $0.001 Sonnet input + structured output). Well within Growth tier margin. Gate to Growth+ — Free and Starter see the upgrade CTA empty state.

---

## Feature 2 — AI Ad-Copy Generator

### Behavior

At `/dashboard/themes/[theme_id]` or `/dashboard/studio/ads`, the owner generates ad copy for four platforms, grounded in their actual review language.

### Input

Inline form, not a wizard:
- **Theme** — pre-selected if entered via theme card; selectable dropdown otherwise
- **Platform** — Google Search Ads / Google Display / Meta (Facebook + Instagram) / Xiaohongshu post
- **Goal** — New customer acquisition / Rebooking existing / Service awareness
- **Language** — EN / 中文 / ES (defaults to location's primary)
- **Optional audience details** — age range, neighborhood, language preference

### Output — three platform-native variants per generation

Each variant displayed as a card with:
- The ad copy in the platform's native rendering style (preview that matches what it'll look like on Google or Meta)
- A **"Source reviews"** expandable panel showing 2-3 reviews each variant pulled from
- Edit-in-place capability
- Star to save / Generate variation / Copy to clipboard / Export to CSV

**Google Search Ads format:**
- 3 headlines (30 chars max each)
- 2 descriptions (90 chars max each)
- Headlines cite a specific review phrase; descriptions stay claim-conservative

**Google Display Ads format:**
- 1 short headline (30 chars)
- 1 long headline (90 chars)
- 1 description (90 chars)
- Suggested visual: link to existing social graphic from Stage 4 if available

**Meta Ads format:**
- 1 primary text (125 chars displayed, 500 max)
- 1 headline (40 chars)
- 1 description (30 chars)
- Suggested image link

**Xiaohongshu post format:**
- Title (20 chars max — the "钩子" hook line)
- Body (300-500 chars in conversational Mandarin internet vernacular)
- 5-8 suggested hashtags (in Chinese, real ones, not invented)
- Suggested cover image

### Save, export, attribution

Owner can:
- **Star** variants they want to keep (saved to `ad_copy_drafts` with `starred_at`)
- **Export** starred variants as CSV format for Google Ads Editor, plus a Meta-compatible CSV
- **Copy** any variant to clipboard with one click
- **Regenerate** any variant with feedback ("emphasize the Chinese-speaking patient angle more" → new generation)

The **"Source reviews"** panel is the trust feature. Every claim in every variant traces back to a specific review. This is what differentiates BAAM's ad generator from a generic LLM ad tool — the SMB owner can verify the variant isn't fabricated.

### Compliance

The prompt explicitly forbids:
- Medical claims (treatments, cures, guaranteed outcomes)
- Comparative claims about other businesses
- Inventing quotes — every quoted phrase must trace to a real review
- Star-rating manipulation language

The owner is the author of record for anything exported. BAAM is a tool, not a publisher.

### Cost

~$0.03 per generation via Sonnet 4.6 with structured output. Generous Growth-tier limit: 50 generations per month per location. Unlimited on Agency. Track via `ai_usage_events`.

---

## Feature 3 — Auto-Published Testimonial Pages

### Why this is the most strategic feature

Of the four Compound features, this is the one with the longest compounding value. A testimonial page generated in month 6 of a customer's BAAM subscription still drives organic traffic in month 36. Reviews collected for stage 1 become permanent SEO assets via stage 7.

### Cadence

Default: **every 60 days**, but configurable from monthly to quarterly per location in `/dashboard/settings/compound`. Don't ship a hardcoded rule — restaurants with high content velocity want monthly; specialized clinics want quarterly.

For Growth+ tier locations with ≥30 reviews, the scheduled job (`/api/cron/generate-testimonial-pages`) runs on the cadence and:

1. Identifies top 3-5 themes by mention count where no active testimonial page exists for that location+theme combination
2. For each theme, generates a draft landing page (see structure below)
3. Saves to `landing_pages` with `status='draft'`
4. Notifies the owner via email + dashboard notification
5. Owner reviews at `/dashboard/landing-pages`, can edit copy, swap testimonials, or approve as-is
6. On approval, `status='published'`, page goes live

### Page structure

Each generated page renders at one of two URL patterns:
- **Default:** `baamreview.com/testimonials/[location-slug]/[theme-slug]`
- **Customer-domain embed (the killer feature):** `<script src="https://baamreview.com/api/testimonial-page/dr-huang/migraines.js"></script>` placed in the customer's site renders the page at `drhuang.com/testimonials/migraines`. SEO juice flows to the customer's domain.

For BAAM Studio clients already on the BAAM platform, integration is even tighter — testimonial pages auto-inject into their existing `clients/<client>/` site structure via the same JSON content contract pattern.

### Page sections

1. **Hero**
   - Eyebrow: "What patients say about" (or 中文 / ES equivalent)
   - Headline: theme name + service + location, in Fraunces 400
   - Lead paragraph: 80-120 words written by Claude using the theme's example reviews as source material; reads editorial, not promotional

2. **The reviews themselves** — 6-12 testimonial cards
   - Real reviews mentioning the theme
   - Each with rating, author initial, language tag, source platform (Google / first-party)
   - Mixed languages reinforce the trilingual story — a Chinese review next to a Spanish one next to an English one signals authenticity, not translation

3. **Aggregate signal**
   - "47 patients have mentioned [theme] across all reviews"
   - Average rating for reviews mentioning the theme
   - Trend: "Increasingly mentioned in the past 6 months" if applicable

4. **CTA panel**
   - Location info, phone, booking link, embedded map
   - Specifically a CTA tied to the theme: for migraine-themed page, "Schedule a migraine consultation"
   - Trust strip: "Verified [N] reviews on Google" with Google logo

5. **FAQ section**
   - 3-5 questions auto-generated from the theme's review content
   - For migraines theme: "How many sessions before patients see results?" / "Do you accept insurance?" / "What's the consultation like?"
   - Each answer pulled from review language plus generic claim-safe medical/legal/restaurant copy

6. **Related testimonial pages** — internal linking to the location's other auto-generated pages

7. **Schema.org markup** in JSON-LD:
   - `LocalBusiness` for the location
   - `AggregateRating` for the theme
   - `Review` for each displayed testimonial
   - `FAQPage` for the FAQ section
   - `BreadcrumbList` for navigation
   - All compliant with Google's structured data testing tool

### Refresh cadence

Every 30 days, all published pages re-render with new reviews from the past period. Stale-looking pages with the same 8 reviews for 6 months are an SEO liability; rotating fresh testimonials keeps the page "alive" in Google's eyes.

### Compliance — consent and claims

Reviews from `first_party_reviews` only appear if the customer consented (`consent_display = true`). The consent check happens at the data layer when the page renders; non-consented reviews omit silently. Reviews from `imported_reviews` (sourced from Google) are public-domain and always eligible.

For medical/legal verticals, an automatic disclaimer renders in the footer: "Individual results vary. The reviews displayed are personal experiences and do not constitute medical or legal advice."

### Cost

~$0.06 per page generation. ~$0.04 per 30-day refresh. Per location per 60 days: ~$0.30. Negligible. Don't even meter this — included in Growth tier.

---

## Feature 4 — Review Studio (the Review-to-Content Pipeline)

This is the marquee Compound feature. Designed with substantially more depth than the others because it's the most differentiated and least obvious.

### The core insight

Every other SMB video tool produces one video at one format. The SMB owner then has to crop, re-edit, re-time, and re-upload for each destination platform — which is why ~95% of local businesses post videos to at most one platform.

Review Studio renders **six platform-native formats from one source review in one composition pass**. The owner reviews once, downloads once or one-clicks-posts once, and ends up with platform-optimized content everywhere.

### The six output formats

| Format | Aspect | Length | Destination | Optimization |
|---|---|---|---|---|
| **Vertical Short** | 9:16 | 15-20 sec | TikTok / Reels / Xiaohongshu | Fast cuts, hook in first 1 sec, trending audio cue |
| **Vertical Long** | 9:16 | 30-50 sec | YouTube Shorts | Slower pacing, deeper narrative, hardcoded captions |
| **Landscape Hero** | 16:9 | 60-90 sec | YouTube long-form, website hero | Branded intro/outro, slower pacing, music-forward |
| **Landscape Ambient** | 16:9 | 8-12 sec | Website hero loop, email banner | Silent, autoplay-safe, text overlay, seamlessly looped |
| **Square Standard** | 1:1 | 30 sec max | GBP video post | GBP video spec compliant, large captions, end-card |
| **Square Mini** | 1:1 | 6-8 sec | Email signature, footer | GIF + MP4 dual export, looping, no audio required |

All six render from the same source review, the same brand color, the same voice talent, the same music — composed differently for each destination platform's algorithms and rendering quirks.

### Three style presets

The owner picks a default style per location in settings; can override per video on generation.

#### Style A — Editorial Quote (default, Growth tier)

The reliable, always-looks-good option. Ships first.

- Branded paper-cream background with subtle grain texture
- Customer's review quote rendered in **Fraunces italic** with kinetic typography (one phrase group at a time, gentle fade-in)
- AI voiceover reads the review in the source language (ElevenLabs `eleven_multilingual_v2`)
- Background music: licensed, mood-matched to review sentiment (8-12 track library, AI-selected)
- Closes with clinic logo, name, location, booking CTA, branded QR code
- Gold accent treatment on closing frame matches the existing brand system

**Cost per video set (all 6 formats):** ~$0.40 (ElevenLabs voiceover + Remotion render + storage)
**Render time:** ~2 minutes for the full 6-format set
**Included on Growth tier:** 2 video sets per month
**Best for:** Healthcare, legal, professional services — anywhere trust and editorial polish matter more than visual variety

#### Style B — Documentary B-Roll (Growth tier with usage cap)

Style A plus contextual b-roll footage cuts.

- Style A composition, but with 3-5 second clips of relevant footage between text frames
- B-roll sourced from:
  - **Pexels API** (free): generic stock matching the location's vertical (acupuncture: hands working, herbs; immigration law: documents, handshakes; restaurants: food prep, dining)
  - **Veo 3 API** (paid, Agency-tier or per-credit): custom-generated b-roll matching the location's actual environment via uploaded reference photos
- The kinetic quote stays on screen as the b-roll plays beneath/alongside
- Same voiceover, music, closing frame structure as Style A

**Cost per video set:**
- With Pexels b-roll: ~$1.20
- With Veo b-roll: ~$3.80

**Included on Growth tier:** 1 Pexels-based set per month
**Veo-based sets:** Agency tier (5/month) or per-credit add-on ($5 each)

**Best for:** Restaurants, retail, home decor, real estate — verticals where visual context strengthens the testimonial. Less appropriate for healthcare (generic stock medical footage feels off-brand).

#### Style C — Spokesperson Avatar (v1.8 deferred, NOT in v1.7)

Talking-head AI avatar presenting the review. Technically possible with HeyGen API.

**Deferred to v1.8 because:**
1. 2026 avatar uncanny-valley is real, especially in healthcare and legal verticals where trust is paramount
2. The AI avatar industry's brand reputation is currently mixed — some prospects will be uncomfortable
3. The marginal value over Style A/B is unclear for short-form testimonial content

Revisit in v1.8 after seeing 6 months of v1.7 customer behavior. If multiple Agency customers specifically request it, ship. If nobody asks, skip permanently.

### Render Architecture

**Composition layer: Remotion + Remotion Lambda**
You've already explored Remotion for BAAM Platform's real estate property videos. Reuse the patterns. Each style is a Remotion composition with parameterized inputs (review text, location brand color, logo URL, voiceover URL, music track, b-roll URLs). One composition renders all six format variants by mapping over `[1080×1920, 1080×1920_long, 1920×1080, 1920×1080_ambient, 1080×1080, 1080×1080_mini]` with format-aware layout logic.

**Voiceover: ElevenLabs `eleven_multilingual_v2`**
Supports EN/中文/ES natively with excellent quality in all three. Voice ID stored per location (`locations.video_voiceover_voice_id`) so the same voice represents the business across all videos. Owner can pick from 8-10 curated voices during setup, sorted by language preference and personality (warm, professional, conversational, energetic).

**B-Roll Sources:**
- **Pexels API** (free tier): 200 API calls/day shared across all locations, cached aggressively by vertical+keyword. Sufficient for Style B at v1.7 scale.
- **Veo 3 API** (Google Cloud): paid per-second of generated video. Output queued and cached per location.

**Music: Artlist or Epidemic Sound API**
Licensed library curated to ~12 tracks across moods (calm, uplifting, professional, warm, energetic, contemplative). Selection algorithm matches mood to review sentiment + vertical (calm for TCM, professional for legal, warm for restaurants).

**Output Storage: Supabase Storage**
Under `review-videos/{location_id}/{video_set_id}/{format}.mp4`. CDN-served via Supabase's built-in CDN. Each video set is ~50MB total across all six formats; storage cost is real but modest (~$0.10/month per set after CDN delivery).

**Render Pipeline:**
1. Cron picks source review, runs `video-script.ts` prompt to generate timed script
2. ElevenLabs renders voiceover (~10 seconds)
3. Pexels or Veo fetches/generates b-roll (~30-90 seconds)
4. Music selected from curated library
5. Remotion Lambda renders six format compositions in parallel (~2-4 minutes)
6. Videos uploaded to Supabase Storage
7. Caption variants generated per platform via `video-caption-generator.ts`
8. Owner notified

**End-to-end time:** ~3-5 minutes from cron trigger to notification. Owner sees videos ready next morning if they generate overnight.

### Cadence and source selection

Configurable in `/dashboard/studio/settings`:
- **Off** (default for new accounts)
- **Monthly** (1st of each month)
- **Bi-weekly** (1st and 15th)
- **Manual only** (no cron, owner triggers via "Generate from this review" button on any review)

When the cron fires (`/api/cron/generate-review-videos`), per location:

1. Pulls candidate reviews from past period
2. Scores each: `(rating × 10) + (consent_display ? 5 : 0) + (length_normalized × 3) + (theme_strength × 2) + (recency × 1)`
3. Excludes reviews already used in a video in the past 6 months
4. Picks top scorer
5. Generates 1 video set in the location's default style
6. Saves to `review_video_sets` table with `status='ready_for_review'`
7. Sends notification

### The owner review experience

The most important UI in Review Studio. This is where the magic of "6 formats from 1 review" becomes tangible.

**Dashboard surface at `/dashboard/studio`:**

```
┌─────────────────────────────────────────────┐
│  Review Studio                              │
│  Three video sets ready for review          │  ← header
│                                             │
│  ┌─ Wei Zhang · 5★ · Posted Apr 8 ──────┐  │
│  │                                       │  │
│  │  [▶ Preview thumbnail with play icon] │  │
│  │                                       │  │
│  │  "Came in for chronic back pain..."   │  │  ← italic Newsreader
│  │                                       │  │
│  │  Six formats ready:                   │  │
│  │  ● Vertical Short  ● Vertical Long    │  │
│  │  ● Landscape Hero  ● Landscape Loop   │  │
│  │  ● Square GBP      ● Square Mini      │  │
│  │                                       │  │
│  │  [Approve & Download] [Edit] [Skip]   │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌─ Sarah Liu · 5★ · 中文 ──────────────┐  │
│  │  ... another card                     │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

Clicking **[Preview thumbnail]** opens a full-screen previewer with format tabs:

```
┌────────────────────────────────────────────┐
│  × Close       Wei Zhang · 5★              │
│                                            │
│  [Vertical Short][Vertical Long][Hero]    │
│  [Loop][GBP Square][Mini]                  │  ← tab strip
│                                            │
│        ┌─────────┐                         │
│        │         │                         │
│        │  VIDEO  │  ← live preview in      │
│        │ PREVIEW │     selected format     │
│        │         │                         │
│        └─────────┘                         │
│                                            │
│  ─── Caption for this destination ──────  │
│                                            │
│  Xiaohongshu caption (editable):           │
│  "🙏 一位耐心的医生..."                    │  ← AI-generated, editable
│                                            │
│  [Download MP4] [Copy caption] [Schedule]  │
└────────────────────────────────────────────┘
```

Each format tab shows:
- **The actual rendered video** at correct aspect ratio with playback
- **The platform's recommended caption** (different per platform), editable inline
- **Platform-specific notes** ("YouTube Shorts: Add this to YouTube Studio with hashtags #shorts #localbusiness")
- **Download** button → MP4 file
- **One-click post** button → opens platform's composer with video + caption pre-filled (v1.8 native API integration; v1.7 ships with composer deep-links)
- **Schedule** button → schedule for posting via integration (v1.8)

### Distribution destinations (v1.7 launch coverage)

| Destination | v1.7 Mechanism | v1.8 Plan |
|---|---|---|
| **YouTube Shorts** | Download + manual upload, or "Open in YouTube Studio" deep link | Native API auto-post |
| **YouTube long-form** | Download + manual upload to YouTube Studio | Native API auto-post |
| **TikTok** | Download + "Open TikTok composer" deep link with video | Native API auto-post |
| **Instagram Reels** | Download + share to Instagram via mobile share sheet | Native API via Meta Business |
| **Xiaohongshu** | Download + "Open Xiaohongshu composer" (web) | Native API (if available) |
| **GBP video post** | "Post to GBP" button (Google Business Profile API supports this) — NATIVE in v1.7 | Same |
| **Website hero** | Download → owner adds to site, or "Copy embed snippet" for one-line iframe | Same |
| **Email signature** | Download both MP4 and GIF | Same |

The GBP native integration is the most valuable v1.7 distribution win. SMBs who post videos to their GBP profile dramatically outperform those who don't in Local Pack rankings, and almost nobody does it because creating GBP-spec videos manually is too much work. BAAM Review delivers them automatically.

### Pricing structure for video

| Tier | Style A included | Style B Pexels included | Style B Veo | Style C |
|---|---|---|---|---|
| **Free** | – | – | – | – |
| **Starter** | – | – | – | – |
| **Growth** | 2/month | 1/month | $5/credit | – |
| **Agency** | Unlimited | Unlimited | 5/month | v1.8 |

**Video Credits Pack add-on:**
- 10 credits for $40 (~$4 each)
- One credit = one Style A set, two credits = one Style B Pexels set, four credits = one Style B Veo set
- Credits never expire
- Available at `/dashboard/billing/credits` to any paying tier
- Stripe metered billing not required for v1.7 — credits debited from a `video_credit_balance` column on `accounts`

### Why this is genuinely valuable (and you're right that it transforms BAAM)

A standalone AI video generator (Sora, Runway) is a commodity. Review Studio is not, for three reasons:

1. **Source material exclusivity.** BAAM uniquely sits on the trove of customer reviews. The video pipeline is the natural exhaust. No competitor can match the corpus volume.

2. **Format multiplication.** Six platform-native formats from one render pass is genuinely operationally hard. Doing it in three languages with consistent brand color, voice, and pacing is harder. Doing it with grounded review content (no hallucinated quotes) is hardest. The technical moat is real.

3. **GBP integration.** GBP video posts are the underutilized 2026 SEO advantage. BAAM is positioned to be the dominant source of GBP video content for local SMBs, particularly in the Chinese-speaking community where no other player operates.

The reason this transforms BAAM's value proposition: post-v1.7, **BAAM is not a review collector. BAAM is the SMB's marketing automation platform that happens to start with review collection.** That's a much larger TAM and a much higher willingness-to-pay than "Birdeye alternative."

---

## Schema additions

Deploy as v2.1 migration in Session 33 (start of v1.7 build):

```sql
-- Tables already in v2.0 schema (no changes):
-- review_themes, landing_pages

-- New tables for v1.7 Compound:

create table ad_copy_drafts (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade not null,
  theme_id uuid references review_themes(id) on delete set null,
  platform text not null check (platform in ('google_search','google_display','meta','xiaohongshu')),
  goal text not null check (goal in ('acquisition','rebooking','awareness')),
  language text not null check (language in ('en','zh','es')),
  variants jsonb not null,
  starred_variant_ids text[],
  exported_at timestamptz,
  generated_by uuid references users(id),
  created_at timestamptz default now()
);

create index idx_ad_drafts_location on ad_copy_drafts(location_id, created_at desc);

-- Video sets: one source review → six format renders
create table review_video_sets (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id) on delete cascade not null,
  source_review_id uuid,
  source_review_type text check (source_review_type in ('imported','first_party')),
  source_language text not null check (source_language in ('en','zh','es')),
  style text not null check (style in ('editorial_quote','b_roll_pexels','b_roll_ai','avatar_v18')),
  voiceover_voice_id text,
  music_track_id text,
  music_mood text check (music_mood in ('calm','uplifting','professional','warm','energetic','contemplative')),
  render_started_at timestamptz,
  render_completed_at timestamptz,
  total_render_cost_cents integer,
  status text default 'queued' check (status in ('queued','script_ready','rendering','ready_for_review','approved','partially_posted','fully_posted','archived','failed')),
  approval_user_id uuid references users(id),
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_video_sets_location_status on review_video_sets(location_id, status);

-- Per-format video records
create table review_video_formats (
  id uuid primary key default uuid_generate_v4(),
  video_set_id uuid references review_video_sets(id) on delete cascade not null,
  format text not null check (format in (
    'vertical_short','vertical_long','landscape_hero',
    'landscape_ambient','square_gbp','square_mini'
  )),
  video_url text,
  thumbnail_url text,
  duration_seconds numeric(5,2),
  width integer,
  height integer,
  file_size_bytes bigint,
  caption_text text,
  caption_language text,
  caption_hashtags text[],
  posted_destinations jsonb,
  created_at timestamptz default now(),
  unique (video_set_id, format)
);

create index idx_video_formats_set on review_video_formats(video_set_id);

-- Per-location video settings
alter table locations
  add column video_generation_cadence text default 'off' check (video_generation_cadence in ('off','monthly','biweekly','manual_only')),
  add column video_default_style text default 'editorial_quote' check (video_default_style in ('editorial_quote','b_roll_pexels','b_roll_ai')),
  add column video_voiceover_voice_id text,
  add column video_music_preference text default 'auto',
  add column testimonial_pages_enabled boolean default true,
  add column testimonial_pages_cadence text default 'bimonthly' check (testimonial_pages_cadence in ('monthly','bimonthly','quarterly')),
  add column theme_mining_enabled boolean default true;

-- Video credits balance
alter table accounts
  add column video_credit_balance integer default 0,
  add column total_video_credits_purchased integer default 0;

create table video_credit_transactions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references accounts(id) on delete cascade not null,
  delta integer not null,
  reason text not null check (reason in ('purchase','consumption','grant','refund','adjustment')),
  related_video_set_id uuid references review_video_sets(id),
  stripe_payment_intent_id text,
  notes text,
  created_at timestamptz default now()
);

create index idx_credit_txn_account on video_credit_transactions(account_id, created_at desc);

-- AI usage tracking is extended for v1.7 features
-- ai_usage_events already exists; ensure these event types tracked:
--   'theme_mining', 'ad_copy_generation', 'testimonial_page_generation',
--   'video_script_generation', 'video_caption_generation', 'voiceover_synthesis',
--   'b_roll_pexels_fetch', 'b_roll_veo_generation', 'remotion_render'
```

RLS for new tables follows the v2.0 pattern: scoped to account membership for owner read/write, default deny otherwise. Public-facing testimonial pages bypass RLS via `service_role` reads in server components.

---

## AI prompt registry — five new prompts

Built in Sessions 33-37. Full text in Appendix A; summary here:

| Prompt | Model | Frequency | Purpose |
|---|---|---|---|
| **theme-mining** | Sonnet 4.6 | Nightly | Cluster reviews into themes across languages |
| **ad-copy-generator** | Sonnet 4.6 | On-demand | Generate 3 platform-native ad variants per request |
| **testimonial-page-generator** | Sonnet 4.6 | 60-day cadence | Generate full landing page structure including FAQ + schema |
| **video-script** | Haiku 4.5 | Per video set | Generate timed script with scene markers |
| **video-caption-generator** | Haiku 4.5 | Per video set | Generate platform-native captions for 6 destinations |

---

## Session plan — Sessions 33 through 40

Revised allocation for v1.7 with the premium video pipeline:

| Session | Focus | Duration |
|---|---|---|
| **33** | Theme mining cron + Themes Dashboard UI (the premium editorial treatment) | 10-12 hr |
| **34** | AI Ad-Copy Generator with source attribution panels | 8-10 hr |
| **35** | Testimonial Pages — generation engine + admin review UI | 10-12 hr |
| **36** | Testimonial Pages — customer-domain embed snippet + Schema.org markup audit | 6-8 hr |
| **37** | Review Studio Style A (editorial quote) — full 6-format render pipeline end-to-end | 12-14 hr |
| **38** | Review Studio Style B (b-roll) — Pexels integration + Veo API integration | 10-12 hr |
| **39** | Review Studio review UI + caption generation + GBP native posting | 10-12 hr |
| **40** | Compound polish, video credit billing flow, analytics, marketing page updates | 8-10 hr |

**v1.8 deferred work** (4-6 sessions after v1.7 ships):
- Style C talking-head avatar (revisit based on customer demand)
- Native API integrations for one-click posting to YouTube, TikTok, Instagram, Xiaohongshu
- Multi-location theme aggregation for Agency-tier multi-property accounts
- Theme-based audience segmentation in ads
- Video performance attribution (post performance → revenue attribution loop)

Total Sessions 33-40: ~12-14 weeks of agent work. Realistic v1.7 launch: 6-7 months after v1 launch. The customer base needs that long to accumulate enough reviews to make Compound features meaningful.

---

## Pricing implications and marketing copy

### Updated tier features (effective v1.7 ship date)

**Free tier:** No Compound features. Empty state with upgrade CTA on themes, studio, etc.

**Starter ($49/$39 founding):** No Compound features. Same empty state.

**Growth ($99/$89 founding):**
- Themes Dashboard (full access, nightly mining)
- AI Ad-Copy Generator (50 generations/month)
- Auto-Published Testimonial Pages (up to 5 active pages per location)
- Review Studio:
  - Style A: 2 video sets/month included
  - Style B Pexels: 1 video set/month included
  - Style B Veo: $5/credit add-on
  - All 6 platform formats per generation
  - GBP native posting included
- Video Credits Packs available

**Agency ($499/$249 founding):**
- All Growth features unlimited
- Review Studio:
  - Style A: unlimited
  - Style B Pexels: unlimited
  - Style B Veo: 5 sets/month included, additional at $4/credit (discount)
  - Multi-location theme aggregation
  - White-label testimonial page embeds
- Style C (avatar) v1.8 access when available

### Marketing positioning evolution

Pricing page tier narratives update when v1.7 ships:

- **Growth narrative:** "Turn reviews into revenue" → **"Turn reviews into revenue and platform-native content"**
- **The 7-stage loop graphic on the marketing home:** Stage 7 icon expands to show its four outputs (themes / ads / pages / videos)
- **New marketing section on the home page** (added when v1.7 ships): "One review becomes six pieces of content" — with a visual showing the same source review rendered in vertical, landscape, square, and GIF formats with the destination platforms labeled

Don't update marketing copy at v1 launch. Layer v1.7 changes on top when Compound actually ships.

---

## Risk register

Five risks specific to Compound features. None block shipping; each affects unit economics or quality.

### 1. Video render costs scale with success

The current cost model assumes:
- Style A: ~$0.40 per video set
- Style B Pexels: ~$1.20 per video set
- Style B Veo: ~$3.80 per video set

Growth tier ($99/mo) margin on the included video sets: 2 Style A + 1 Style B Pexels = ~$2.00 in cost = ~98% margin. Healthy.

**But if Veo credit attach rate hits 30%+ of Growth accounts:**
Average Growth account consumes (2 × $0.40) + (1 × $1.20) + (2 × $5 credits × $3.80 Veo cost) = $9.60 cost per month per account on a $99 plan. Margin drops to 90%. Still fine, but not for free.

**Mitigation:** Monitor video credit attach rate monthly. If it goes above 40%, raise base prices, lower included Veo allocations, or shift Veo to a usage-priced tier separate from credits.

### 2. AI b-roll quality is variable

Veo 3 in 2026 is good for generic scenes (people, environments, simple actions) but mediocre for highly specific contexts ("acupuncture needles being placed on a back," "an immigration lawyer reviewing a green card application"). Audit 20 generated videos before promoting Style B Veo publicly.

If failure rate exceeds 15%, options:
- Gate Style B Veo behind a manual approval queue (owner reviews before render finalizes)
- Keep Style B at Pexels-only for v1.7 and defer Veo to v1.8
- Build a "vertical pack" curated b-roll library — pre-rendered Veo footage for the top 5-7 verticals stored as reusable assets

### 3. Schema markup gets gamed

Auto-generated testimonial pages with full Review + AggregateRating schema markup are exactly what Google's spam detection looks for in low-quality SEO play.

**Mitigations:**
- Only generate pages for themes with ≥ 8 supporting reviews (real signal floor)
- Include diverse review sources (not just first-party — mix in Google-imported)
- Internal link the testimonial pages to the location's verified GBP via `LocalBusiness` markup
- Use real `dateModified` and `dateCreated` timestamps (refresh keeps these accurate)
- Cap auto-generated pages at 12 per location — beyond that, the long-tail SEO returns are minimal anyway

Watch for deindexing in Google Search Console during the first 60 days of testimonial page launch. If it happens for any location, pause auto-generation for that location and investigate the source pattern.

### 4. Ad-copy compliance hallucinations

LLM-generated ad copy could include claims the source reviews don't support, even with explicit prompt guards.

**Mitigation:** Every variant generated includes mandatory "Source reviews" panel. The owner must star and export — nothing auto-publishes. Owner is the author of record exactly as in the customer review-drafting flow. This is the same compliance posture; reuse the same legal copy.

### 5. Voice consistency across cadence

A location generates 12 review videos a year. If the voice changes between videos, the brand feels inconsistent.

**Mitigation:** `locations.video_voiceover_voice_id` locks the voice per location after first selection. Owner can change it, but the change applies to future videos only — never re-renders previous ones with the new voice. This means the location's archive of generated videos stays internally consistent even as preferences evolve.

---

## What this addendum doesn't change

To be explicit about scope:

- **Sessions 1-12 are unchanged.** v1 builds exactly as `SESSION_1_BRIEF.md` and `SESSIONS_3_TO_12_BRIEFS.md` describe.
- **The launch playbook is unchanged.** `LAUNCH_CHECKLIST.md` describes v1 launch — Compound features are not promised to founding customers as part of the launch deal. They arrive when v1.7 ships, free, as part of the locked-in Growth tier pricing.
- **The 8 HTML prototypes are unchanged.** Compound prototypes will be designed in a dedicated v1.7 design session, ~5-6 months from now.
- **The brand assets are unchanged.** Same tokens, same typography, same logo system. New surfaces will use them.
- **The master plan §3.7, §8.7, §13.7 remain valid** but this addendum supersedes them for Stage 7 specifically.

---

## Appendix A — Sample prompt structures

Full prompts written in Sessions 33-37. Shapes below for reference.

### Theme mining (system prompt excerpt)

```
You are analyzing customer reviews to identify recurring themes — observations that multiple customers independently mention.

Important rules:
- Cluster across languages. Chinese "细心" (xìxīn = attentive/careful), English "attentive", and Spanish "atento" describe the SAME theme. Identify the theme, not the wording.
- Distinguish themes (3+ customers mention) from one-off compliments.
- Theme names: 2-4 words, business-appropriate
- Theme descriptions: one clear sentence
- Identify 5-15 themes. Quality over quantity.

Output strict JSON:
{
  "themes": [
    {
      "theme_name": "string",
      "theme_description": "string",
      "example_review_ids": ["uuid","uuid","uuid"],
      "supporting_quotes": [
        {"text": "string", "language": "en|zh|es", "review_id": "uuid"}
      ],
      "estimated_strength": "weak|moderate|strong",
      "trend_signal": "growing|stable|fading"
    }
  ]
}
```

### Video script generation (system prompt excerpt)

```
Write a short video script based on a customer review. The video will be rendered in SIX formats simultaneously (vertical short, vertical long, landscape hero, landscape ambient, square GBP, square mini) — your script must work for the master timeline; format-specific cropping happens at render time.

Use the master timeline of 30 seconds. Format renderers will crop to their length:
- 0-15s: core narrative beat (used in all formats)
- 15-30s: extended detail (used in long formats only)

Structure scenes for the master timeline. Each scene:
- start_seconds, end_seconds
- voiceover (read by AI voice)
- on_screen_text (kinetic typography phrase, ≤ 6 words)
- scene_description (for b-roll match or scene composition)

Rules:
- Voiceover script max 90 words total
- On-screen text and voiceover NEVER duplicate; they reinforce
- Closing scene (last 4 seconds): location name + CTA + branded close
- Match energy of source review (measured 4-star vs enthusiastic 5-star)
- Voiceover in source language, idiomatic register (not translated)

Output strict JSON:
{
  "scenes": [...],
  "master_duration_seconds": 30,
  "music_mood_suggestion": "calm|uplifting|professional|warm|energetic|contemplative",
  "voice_emotion_tag": "warm|measured|enthusiastic|professional"
}
```

### Per-platform caption generation (system prompt excerpt)

```
Generate platform-native captions for a video about a customer testimonial. You will generate captions for SIX destinations simultaneously, each with its native conventions.

Source: video script, source review, location info, target language.

Generate captions adapted for:

1. youtube_shorts: 100-200 chars, hook-first, 2-3 hashtags incl. #shorts
2. youtube_longform: 200-400 chars, story arc, 5-8 hashtags, CTA at end
3. tiktok: 50-150 chars, trending-style language, 3-5 hashtags
4. instagram_reels: 100-200 chars, emoji-friendly, 5-8 hashtags
5. xiaohongshu: 300-500 chars in 中文, conversational vernacular, 8-12 Chinese hashtags. Use small note (笔记) style — opens with hook, ends with engagement question.
6. gbp_post: 50-300 chars, professional, no hashtags, links to booking URL

Match the language of the source video. For xiaohongshu specifically, ALWAYS Chinese regardless of source language.

Output strict JSON with one caption per destination.
```

---

## Closing note

The Review-to-Content Pipeline (Feature 4) is the largest single feature in BAAM Review's entire roadmap. It's also the one most likely to materially shift willingness-to-pay at the upper tier.

Three pieces of advice for when v1.7 finally ships:

1. **Don't market Compound during v1 launch.** The promise is too big and the proof isn't there yet. Talk about Stages 1-6 only at launch. Drop the Compound announcement into a separate, splashier moment ~6 months later when there are real testimonial videos from real customers to show.

2. **The first 3-5 Compound customers should be hand-onboarded.** Just like the founding 50 for v1, the Compound features need personal walk-through onboarding. Don't let people stumble into video generation without understanding what to do with the output.

3. **Capture the videos publicly.** When real customers start posting BAAM-generated GBP videos, screen-capture them and put them in a public gallery at `baamreview.com/showcase`. Social proof on the product itself becomes the marketing material.

This addendum locks the design. Sessions 33-40 build it. The hard part isn't the technology — it's the patience to wait until the customer base is ready to use it.

---

**End of Compound Stage Addendum.**
