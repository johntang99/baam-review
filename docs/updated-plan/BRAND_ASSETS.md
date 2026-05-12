# BAAM Review — Brand Asset Kit

**Version:** 1.0
**Date:** May 12, 2026
**Purpose:** Complete brand system for BAAM Review — design tokens, logo variants, social asset specs, and launch graphics.

---

## Brand essence

BAAM Review's visual identity is **editorial premium**, not SaaS-blue. It positions BAAM Review as a $99/month engine that earns its rent, not a $19/month app you forget you signed up for. The aesthetic borrows from the New York Times, premium spirits brands, and the slow-design movement — Fraunces serif italic on cream, with a forest-green ink and a gold accent that lifts the page without screaming.

Three principles that shape every visual decision:

1. **Earnest, not cute.** Local business owners are skeptical of cute. BAAM Review's visual identity is confident and quiet.
2. **Editorial, not promotional.** The product treats the customer's review as a piece of writing, not a "social proof asset." The brand follows that posture.
3. **Trilingual by design.** Every visual artifact has to render correctly in English, Chinese, and Spanish. Typography choices, color contrast, and layout all account for this.

---

## Color palette

### Primary colors

| Token | Hex | Usage |
|---|---|---|
| `ink` | `#0F1F1A` | Body text, dark backgrounds, dominant typography on cream |
| `cream` | `#FAF7F2` | Page background, primary surface |
| `cream-deep` | `#F0EBE0` | Secondary surface, card backgrounds within cream |
| `paper` | `#FFFFFF` | Card surfaces, modal backgrounds, contrast on cream |

### Brand colors

| Token | Hex | Usage |
|---|---|---|
| `forest` | `#1F4D3F` | Primary brand color — buttons, primary accents, sidebar |
| `forest-dark` | `#163A30` | Hover state for forest |
| `forest-light` | `#2A6B57` | Subtle backgrounds, tertiary accents |
| `sage` | `#87A899` | Avatar default, neutral semantic states |
| `gold` | `#C9A961` | Accent — pricing emphasis, hero stats, founding-customer markers |
| `gold-dark` | `#A88847` | Hover state for gold |
| `gold-soft` | `#E8D9B5` | Soft gold backgrounds, badge fills |

### Per-location accent (configurable)

Every BAAM Review customer can pick their own brand primary color (stored in `locations.brand_primary_color`). The customer-facing review flow uses this color instead of forest-green. For the Dr. Huang reference designs, the clinic color is:

| Token | Hex | Usage |
|---|---|---|
| `clinic-primary` | `#962D22` | Customer-facing primary (replaces forest in review flow) |
| `clinic-primary-dark` | `#6F1F18` | Hover state |
| `clinic-soft` | `#F8E5E1` | Soft background |
| `clinic-tint` | `#FBF1EF` | Subtle tint, textarea background |

When you build the per-customer accent system in Session 3+, treat the brand color as a CSS custom property at the root and let the customer-facing pages inherit it. The owner-facing admin always uses forest-green; only the public review flow uses the location's brand color.

### Semantic colors

| Token | Hex | Usage |
|---|---|---|
| `success` | `#2D7A5F` | Completed states, consent confirmations |
| `alert` | `#B5443A` | Service recovery, urgent notifications |
| `alert-soft` | `#FCE8E5` | Alert backgrounds |
| `warn` | `#D4924A` | Private feedback awaiting response |
| `warn-soft` | `#FBEAD3` | Warn backgrounds |

### Language identifier colors (used in admin)

| Token | Hex | Usage |
|---|---|---|
| `lang-en-bg` | `#E5EDDF` | English tag background |
| `lang-en-fg` | `#1F4D3F` | English tag text |
| `lang-zh-bg` | `#F8E5E1` | 中文 tag background |
| `lang-zh-fg` | `#8B3A2A` | 中文 tag text |
| `lang-es-bg` | `#FBEAD3` | Español tag background |
| `lang-es-fg` | `#A06820` | Español tag text |

---

## Typography

Four font families, each with a clear role.

### Fraunces — the headline serif

Used for: H1 headings, brand wordmark, large quotation marks, italic emphasis within prose.

**Why Fraunces:** It's a high-contrast modern serif with a distinctive italic that signals editorial premium without being precious. It supports a wide weight range (300–700) and an opsz axis that adapts at large sizes. Free for commercial use via Google Fonts.

**Specifically use:**
- Weight 400 for headlines (most common)
- Weight 500 for sub-headings and pricing numbers
- Weight 300 italic for emphasized words within headlines (the "em" tag pattern across the prototypes)
- Weight 600 only sparingly — for very small caps treatments

**Critical italic usage:** Throughout the prototypes, you'll notice headlines like "Turn happy customers into reviews, **referrals**, and revenue." The italic word is the brand voice signature. Always weight 300, always set in the brand accent color (forest for owner-facing, gold for emphasis, clinic color for customer-facing).

### Newsreader — the body serif

Used for: Sub-headings, italic quotes, footer text, captions.

**Why Newsreader:** Pairs with Fraunces to deepen the editorial feel. Has a slight literary warmth that's perfect for sub-copy. Supports an opsz axis. Free via Google Fonts.

**Specifically use:**
- Weight 400 italic for sub-headings under Fraunces H1s
- Weight 400 italic for blockquote-style customer testimonials
- Weight 500 only for emphasis within Newsreader text

### Onest — the workhorse sans

Used for: Body copy, buttons, navigation, form labels, almost all functional UI text.

**Why Onest:** Modern geometric sans with excellent legibility at small sizes. Pairs surprisingly well with Fraunces because both have similar proportions despite the serif/sans distinction. Free via Google Fonts.

**Specifically use:**
- Weight 400 for body text
- Weight 500 for buttons, labels, navigation
- Weight 600 sparingly — for emphasis within body copy
- Weight 700 only for special cases (badge text, micro-headlines)

### JetBrains Mono — the data mono

Used for: Numbers, timestamps, percentages, code snippets, technical strings.

**Why:** When a number needs to feel precise (revenue attribution, completion percentages, tracking IDs), mono is the right register. JetBrains Mono is friendly enough not to feel cold.

**Specifically use:**
- Weight 400 for inline data
- Weight 500 for emphasized data points

### Noto Sans SC — the Chinese fallback

Used for: When `lang="zh"` is active, the body inherits this. Headlines stay Fraunces (which has CJK glyphs via Noto fallback).

**Why:** Native Chinese readability. Pairs well with Latin Fraunces+Onest because Noto's geometric proportions are similar. Free via Google Fonts.

---

## Logo

### Primary mark

The BAAM Review wordmark is set in Fraunces, weight 500, with a small "B" container mark to its left:

```
[B]  BAAM Review
```

The "B" container is a 32×32px (at base scale) rounded-corner square (8px radius) filled with the brand color (forest or gold), with a centered "B" in Onest weight 600, 14px, in the contrasting color.

**Variants:**

1. **Standard** — forest "B" with cream letter, wordmark in ink — used on cream backgrounds
2. **Inverse** — gold "B" with ink letter, wordmark in cream — used on dark/forest/ink backgrounds
3. **Monochrome** — ink "B" with cream letter, wordmark in ink — used when the brand needs to recede (print, secondary mentions)
4. **Compact** — just the "B" mark, no wordmark — used for favicons, app icons, social avatars

### SVG sources

**Primary wordmark (forest):**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40" fill="none">
  <rect x="0" y="4" width="32" height="32" rx="8" fill="#1F4D3F"/>
  <text x="16" y="26" text-anchor="middle" font-family="Onest, sans-serif" font-weight="600" font-size="16" fill="#FAF7F2">B</text>
  <text x="44" y="28" font-family="Fraunces, serif" font-weight="500" font-size="22" letter-spacing="-0.02em" fill="#0F1F1A">BAAM Review</text>
</svg>
```

**Compact mark (forest, with cream letter):**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect x="0" y="0" width="64" height="64" rx="14" fill="#1F4D3F"/>
  <text x="32" y="46" text-anchor="middle" font-family="Onest, sans-serif" font-weight="600" font-size="36" fill="#FAF7F2">B</text>
</svg>
```

**App icon (forest with gold corner accent):**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" fill="none">
  <rect width="1024" height="1024" rx="220" fill="#1F4D3F"/>
  <text x="512" y="700" text-anchor="middle" font-family="Onest, sans-serif" font-weight="600" font-size="540" fill="#FAF7F2">B</text>
  <circle cx="780" cy="244" r="56" fill="#C9A961"/>
</svg>
```

The small gold circle in the top-right of the app icon is BAAM Review's distinctive mark — it signals "this is the Review product" within the broader BAAM family. The other BAAM products (Platform, Local, SEO) would use different accent colors.

### Logo do's and don'ts

**Do:**
- Use the standard variant on cream backgrounds
- Maintain 16px minimum clear space around the wordmark
- Use the compact mark when space is < 80px wide
- Scale proportionally — never stretch one dimension

**Don't:**
- Recolor outside the four sanctioned variants
- Add a drop shadow, gradient, or outline to the wordmark
- Use Fraunces italic for the wordmark (the wordmark is always upright weight 500)
- Place the logo on a competing color (orange, electric blue, hot pink) — cream, paper, ink, or forest only

---

## Founding Customer Badge

For founding customers to display on their own websites, email signatures, or storefronts.

**SVG source (gold ring + ink text):**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" fill="none">
  <circle cx="120" cy="120" r="116" fill="#FAF7F2" stroke="#C9A961" stroke-width="4"/>
  <circle cx="120" cy="120" r="104" fill="none" stroke="#C9A961" stroke-width="1" stroke-dasharray="2 4" opacity="0.5"/>
  <text x="120" y="80" text-anchor="middle" font-family="Onest, sans-serif" font-weight="500" font-size="11" letter-spacing="0.18em" fill="#A88847">FOUNDING CUSTOMER</text>
  <line x1="60" y1="92" x2="180" y2="92" stroke="#C9A961" stroke-width="0.5" opacity="0.4"/>
  <text x="120" y="132" text-anchor="middle" font-family="Fraunces, serif" font-weight="400" font-style="italic" font-size="42" letter-spacing="-0.02em" fill="#0F1F1A">BAAM</text>
  <text x="120" y="160" text-anchor="middle" font-family="Fraunces, serif" font-weight="400" font-style="italic" font-size="20" letter-spacing="-0.01em" fill="#1F4D3F">Review</text>
  <line x1="60" y1="178" x2="180" y2="178" stroke="#C9A961" stroke-width="0.5" opacity="0.4"/>
  <text x="120" y="200" text-anchor="middle" font-family="Onest, sans-serif" font-weight="500" font-size="10" letter-spacing="0.14em" fill="#A88847">EST. 2026 · NY METRO</text>
</svg>
```

The badge is intentionally circular, intentionally gold-on-cream, and intentionally typographic rather than logo-forward. It looks like a wax-seal mark, which is the editorial-premium signal we want. Customers can put this on their About page, in email signatures, or print it on a card next to the register.

**Variants needed at launch:**
- 240×240 SVG (canonical)
- 1024×1024 PNG (for high-DPI raster usage)
- 240×240 PNG (web standard)
- 80×80 PNG (email signature compact)

---

## Social asset templates

These are the launch templates for Xiaohongshu, Instagram, WeChat Moments, and LinkedIn. Spec'd here; actual PNG generation lands in Session 6 (`social_graphics` table).

### Launch announcement — 1080×1350 portrait (Xiaohongshu, Instagram)

```
┌─────────────────────────────┐
│  [cream paper background]   │
│                             │
│  [Founding Customer badge]  │  ← top, 200×200
│        ─ centered ─         │
│                             │
│  Turn happy customers       │  ← Fraunces 400, 64px, ink
│  into *reviews*,            │  ← italic word in gold
│  *referrals,* and           │
│  *revenue.*                 │
│                             │
│  ─────                      │
│                             │
│  BAAM Review                │  ← Fraunces 500, 28px, forest
│  Live today.                │  ← Newsreader italic, 22px, ink
│                             │
│  First 50 customers         │  ← Onest 500, 14px, text-soft
│  lock $89/mo forever.       │
│                             │
│  review.baamplatform.com    │  ← JetBrains Mono, 13px, gold-dark
│                             │
└─────────────────────────────┘
```

Background: cream with subtle paper-grain texture overlay (same SVG filter as the prototypes use).
Corners: 32px rounded if needed for in-app rendering.

### Customer testimonial card — 1080×1080 square (Xiaohongshu, Instagram)

This is the format that Session 6 auto-generates from top reviews. Spec for design reference:

```
┌─────────────────────────────┐
│  [clinic gradient bg]       │  ← linear gradient using clinic-primary
│                             │     to clinic-primary-dark (160deg)
│  ★ Recommended by a         │  ← gold pill top-left
│      customer               │
│                             │
│  ★★★★★                      │  ← gold stars, 28px
│                             │
│  "Came in for chronic       │  ← Fraunces italic, 28-32px, white
│  migraines and after        │     (max 4 lines, clamp if longer)
│  three sessions I'm         │
│  sleeping through..."       │
│                             │
│  — Sarah L., satisfied      │  ← Onest 400, 14px, white-translucent
│    patient                  │
│                             │
│  ─────                      │  ← divider line, white at 18% opacity
│                             │
│  [Clinic logo]   [QR code]  │  ← clinic logo bottom-left, branded QR
│  Dr. Huang           bottom-right
│  Acupuncture                │
│  Flushing, NY               │
└─────────────────────────────┘
```

The QR code uses the clinic's brand color, not black. The mini-logo in the bottom-left is the clinic's actual logo (uploaded during onboarding).

### Stories format — 1080×1920 (Instagram Stories, WeChat status, Xiaohongshu vertical)

Same testimonial content, taller layout with more breathing room. Quote enlarged, attribution larger, QR code centered at the bottom.

---

## Pitch deck (one-pager PDF)

The PDF you'll send via WeChat for Tier 2 cold-but-validated outreach. One page, A4 portrait, designed for screen reading on phones rather than print.

### Page layout

```
┌─────────────────────────────────┐
│  [Founding Customer badge]      │  ← top-left, 80×80
│                                 │
│  Turn happy customers           │  ← Fraunces 400, 36pt
│  into *reviews,*                │
│  *referrals,* and               │  ← italic in gold/forest
│  *revenue.*                     │
│                                 │
│  BAAM Review · For local        │  ← Newsreader italic 14pt
│  businesses in NY metro         │
│                                 │
│  ─────────                      │
│                                 │
│  THE WEDGE                      │  ← Onest 500, 11pt, tracking
│                                 │
│  Three taps. AI writes a        │  ← Onest 400, 13pt
│  natural draft. Customer        │
│  edits and posts. 60 seconds.   │
│                                 │
│  ─── stats row, three columns ──│
│  ~10%  |  38%   |  60s          │  ← Fraunces 400, 32pt, forest+gold
│  industry | BAAM | time         │  ← labels Onest 400, 10pt
│                                 │
│  THE LOOP                       │
│                                 │
│  Collect → Publish → Display    │  ← 7-stage flow as 2 rows of arrows
│           ↓                     │
│  Distribute → Convert →         │
│           Refer → Compound      │
│                                 │
│  THE PRICE                      │
│                                 │
│  $89/mo locked forever          │  ← Fraunces 500, 24pt
│  First 50 customers only        │  ← Newsreader italic, 13pt
│  $99/mo regular price           │
│                                 │
│  [QR code]   review.baamplatform.com  │  ← QR + URL bottom
│              Reply to this message    │
│              for a 15-min walkthrough │
│                                       │
└─────────────────────────────────┘
```

### Chinese version

Same layout, Chinese typography (Fraunces for headlines with CJK fallback, body in Noto Sans SC), translated copy:

- Headline: "把满意的顾客变成 *好评,* *转介绍,* 和 *营业额。*"
- The wedge: "三下点击。AI 写自然的草稿。顾客改一下就发。60 秒。"
- The loop: "收集 → 发布 → 展示 → 分发 → 转化 → 转介绍 → 复利"
- The price: "$89/月永远锁定。仅限头 50 个客户。正常价 $99/月。"

---

## Email signature

For your personal email when reaching out to founders.

```
John Chen
Founder · BAAM Studio
[BAAM Studio logo]  [BAAM Review badge]
john@baamstudio.com · +1 (xxx) xxx-xxxx
baamstudio.com · review.baamplatform.com
```

Logo lockup: BAAM Studio primary logo at 24px, BAAM Review founding badge at 24px, side by side with 8px gap. The two logos signal "I'm not just a vendor, I'm the founder of both."

---

## Web favicon set

Standard favicon files needed:

- `favicon.ico` (16×16 + 32×32 multi-resolution)
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png` (180×180)
- `android-chrome-192x192.png`
- `android-chrome-512x512.png`
- `safari-pinned-tab.svg` (monochrome mask)

All derived from the **compact mark** (just the "B" container) — `bg: forest`, `fg: cream`, optional gold accent dot. The `safari-pinned-tab.svg` should be ink/black only since Safari masks it.

---

## Voice & tone (quick reference)

This isn't a visual element but it shapes every piece of copy that goes alongside the visuals.

**Three rules:**

1. **Specific over generic.** "Three taps, AI writes a natural draft" beats "Easy-to-use customer experience."
2. **Customer is the hero, BAAM is the tool.** Headlines describe what happens *for the customer*, not what BAAM does. Compare: "Turn happy customers into reviews" ✓ vs. "Our AI generates reviews" ✗.
3. **Numbers beat adjectives.** Whenever possible, quantify. "38% completion rate vs. 10% industry average" beats "much higher completion than competitors."

**Three words to never use:**

- "Solution" — every SaaS uses it; it's noise
- "Powerful" — vague, marketing-corporate
- "Revolutionary" — overpromises, devalues real differentiation

**Three sentence patterns that work:**

- "Most [tools] [do X]. We [do Y]." — establishes contrast
- "[Specific number]× more [outcome]." — quantifies value
- "[Action] in [unit of time]." — promises specific friction reduction

---

## What's missing (deliberately)

This brand kit does NOT specify:

- **Illustration style** — BAAM Review uses photography (warm, editorial, real Chinese-speaking SMB business interiors) sparingly and never custom illustration. The aesthetic is typographic-first.
- **Iconography library beyond Lucide** — the prototypes use Lucide-style strokes at 1.6–2px weight; that's the icon system.
- **Animation principles** — covered in the prototypes and in `SESSION_2_BRIEF.md`'s "design fidelity checklist" section.
- **Print materials** — table cards, posters, etc. will come in a v2 brand kit when we have founding-customer testimonials to feature.

---

## File checklist for v1 launch

The actual asset files you'll need produced before launch day:

- [ ] `logo-primary.svg` (forest wordmark on transparent)
- [ ] `logo-inverse.svg` (gold-on-dark wordmark)
- [ ] `logo-compact.svg` (B mark only)
- [ ] `app-icon-1024.svg` (with gold accent dot)
- [ ] `app-icon-1024.png` (rasterized)
- [ ] `app-icon-512.png`
- [ ] `app-icon-180.png` (apple-touch-icon)
- [ ] `favicon.ico` (multi-resolution)
- [ ] `favicon-32.png`
- [ ] `favicon-16.png`
- [ ] `founding-badge-240.svg`
- [ ] `founding-badge-1024.png`
- [ ] `founding-badge-240.png`
- [ ] `founding-badge-80.png` (email signature)
- [ ] `safari-pinned-tab.svg`
- [ ] `og-image-1200x630.png` (default Open Graph card — Fraunces headline on cream)
- [ ] `pitch-deck-en.pdf` (one-page EN)
- [ ] `pitch-deck-zh.pdf` (one-page 中文)
- [ ] `launch-square-1080.png` (Instagram/Xiaohongshu square)
- [ ] `launch-portrait-1080x1350.png` (Instagram/Xiaohongshu portrait)
- [ ] `launch-stories-1080x1920.png` (Stories format)
- [ ] `demo-video-30s.mp4` (30-second teaser for WeChat)
- [ ] `demo-video-3min.mp4` (full walkthrough for Tier 2 outreach)

All SVG files in this document can be copy-pasted directly. The PNG rasterizations can be generated from the SVGs via `rsvg-convert`, ImageMagick, or any modern design tool (Figma, Sketch). Videos need to be filmed live; they're not in this kit.

---

**Brand kit complete.** This is enough to take BAAM Review from "the code works" to "the code looks like a real product." Honor it consistently across every surface — the design system's power comes from repetition, not novelty.
