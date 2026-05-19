# Review Video Project — Status & Resume Guide

**Status:** ⏸ Paused 2026-05-19 (resuming after more urgent work).
**One-line:** Turn a Google review into a branded short video (vertical Reels +
landscape) for ads / social / website, generated from an admin UI.

This doc lets you (or anyone) catch up cold and continue. Read the
**"Resume here"** section first.

---

## TL;DR — where it stands

| Area | Status |
|---|---|
| `video-studio` standalone repo | ✅ Done (own git repo, relocated out of baam-review) |
| `ReviewSpotlight` video template | ✅ Done, iterated, bug-fixed, 20s, vert + landscape |
| Phase 1 — per-business brand colors | ✅ Done, verified **bit-identical** (zero regression) |
| Supabase persistence (table + bucket) | ✅ Migration `0021` applied & verified live |
| Composer UI prototype | ✅ Done — design-only, for discussion |
| Render backend decision | ✅ Decided: **Remotion Lambda (AWS)** |
| **Phase 2 — Lambda + Accept + Library UI** | ❌ **Not started — this is where to resume** |
| AWS account / IAM / keys | ❌ Not done (user action, gates the deploy) |

---

## The two repos

- **`/Users/johntang/Desktop/clients/video-studio/`** — standalone Remotion
  project (its own git repo, initial commit `eb54422`). Holds the video
  templates + render scripts. `.gitignore` excludes `node_modules/`, `out/`,
  `public/videos/`. Was moved out of baam-review so it can serve any client.
  `realestate/video-studio` was retired (pointer file left there).
- **`/Users/johntang/Desktop/clients/baam-review/`** — the Next.js SaaS.
  Will host the admin UI + Supabase persistence + the render-trigger actions.

---

## What's done (detail)

### 1. The video template — `ReviewSpotlight`
`video-studio/videos/compositions/ReviewSpotlight.tsx`. Scenes: Hook →
Brand + practitioner photo → Google review chip → kinetic phrases → closing
CTA + staggered trust bar. **600 frames / 20s @ 30fps**, renders both
`ReviewSpotlightVertical` (1080×1920) and `ReviewSpotlight` (1920×1080).
Architecture is layered: `videos/utils/` (template-agnostic), `videos/clinic/`
(clinic primitives), `videos/compositions/` (the composition). See
`video-studio/videos/ARCHITECTURE.md`.

### 2. Phase 1 — per-business brand colors (DONE, verified)
- `video-studio/videos/types.ts`: `ReviewVideoData.brand?: Partial<BrandColors>`
- `ReviewSpotlight` resolves `const C = {...DEFAULT_CLINIC_BRAND, ...data.brand}`
  and uses `C.*` for every color (primary/accent/paper/ink…).
- **Verified bit-identical** when no `brand` override: SSIM `1.000000`,
  PSNR `inf` vs the pre-change baseline → a real multi-business template
  with zero regression to the clinic look.
- Known limitation (documented in `video-studio/videos/clinic/brand.ts`):
  decorative primitives (`Sprig`, `DecorativeFrame`, `Stars`,
  `GoogleReviewChip`) still use clinic-gold. A swappable decor layer for
  non-wellness verticals is future work.

### 3. Render today = CLI only
```bash
cd /Users/johntang/Desktop/clients/video-studio
node scripts/generate-video.mjs --site reb --site-id dr-huang --mode reviews
# reads content/<siteId>/reviews/<slug>.json → public/videos/<siteId>/*.mp4
```
Sample data: `content/drhuang/reviews/sofia-degtyar.json`.

### 4. Supabase persistence foundation (DONE, applied, verified live)
- Migration **`baam-review/supabase/migrations/0021_review_videos.sql`** —
  **already run in Supabase** (confirmed: table responds 200, bucket is
  private/video-mp4/100MB).
  - `review_videos` table: account-scoped RLS via locations join;
    authed admins `SELECT`/`DELETE`; INSERT/UPDATE via service role only.
  - private `review-videos` storage bucket; path convention
    `<account_id>/<location_id>/<video_id>-<orientation>.mp4`.
- `baam-review/lib/database.types.ts` updated with `review_videos`. tsc clean.

### 5. Composer UI prototype (design only)
`baam-review/docs/updated-plan/19-admin-video-studio.html` — open in a
browser. Demonstrates the full intended flow: business inputs + "auto-fetch
from site" (mock), review picker (synced list / manual), template gallery,
**Audio** (background music + voiceover toggles, either/both/none),
orientation (Vertical / Landscape / **Both**), Generate → **draft preview**
(not saved) → **Accept & save** vs **Discard & edit** → "Saved to Library"
state. This is the agreed UX target for Phase 2.

---

## Decisions already made

1. **Render backend = Remotion Lambda (AWS).** Chosen over a self-hosted
   worker: for bursty low-volume rendering, Lambda is lower-ops (no 24/7
   process, scales to zero, pay-per-render cents) and less code to maintain.
2. **Draft → Accept model.** Lambda renders to its S3 output (the "draft",
   previewable via signed URL). **Only Accept** copies the MP4 into the
   private `review-videos` Supabase bucket + inserts the `review_videos`
   row. **Discard = no-op**; an S3 lifecycle rule auto-expires abandoned
   draft renders. Drafts never pollute the Library.
3. **Multi-business** via `data.brand`. Start with one template (Spotlight);
   Quote Card / Minimal are future variants.
4. **Storage**: private bucket, short-lived signed URLs, account-foldered.

---

## ▶ RESUME HERE — Phase 2 (not started)

### Step 0 — two open decisions to make first
- **AWS region:** recommended **`us-east-1`** (matches SES/Resend region).
- **Render tracking:** (a) stateless (track only in the open session) vs
  **(b) a minimal `video_jobs` row** (renderId + status + payload +
  location) so a page reload mid-render survives and the Library can show
  "rendering…". **Recommended: (b)** — cheap resilience, ~1 small migration.

### Step 1 — [USER] one-time AWS setup (gates everything AWS)
1. Create an AWS account + add a payment method.
2. Create the Remotion IAM user/role:
   ```bash
   cd /Users/johntang/Desktop/clients/video-studio
   npx remotion lambda policies user      # create IAM user, attach this policy
   npx remotion lambda policies role      # create role + policy
   npx remotion lambda policies validate  # confirm correct
   ```
3. Generate an Access Key for that IAM user.
4. Put creds in **`video-studio/.env`** (gitignored — do NOT paste in chat):
   ```
   REMOTION_AWS_ACCESS_KEY_ID=...
   REMOTION_AWS_SECRET_ACCESS_KEY=...
   ```

### Step 2 — [BUILD] code (most needs no AWS; can start before Step 1)
1. `video-studio`: add `@remotion/lambda`; add deploy scripts + doc:
   - `npx remotion lambda functions deploy` (render function → your AWS)
   - `npx remotion lambda sites create videos/index.ts --site-name=baam-review-videos`
     (uploads the bundle; **re-run whenever the composition changes**)
2. (if decision (b)) migration `0022_video_render_jobs.sql` + types
3. `baam-review` server actions (AWS-agnostic to write):
   - `startVideoRender` → `renderMediaOnLambda(compositionId, props)` with
     the `ReviewVideoData` (incl. `brand`, audio, orientation) → `renderId`
   - `getVideoRenderStatus(renderId)` → `getRenderProgress` (drives the
     composer progress UI)
   - `acceptVideoRender` → fetch MP4 from Remotion S3 → upload to the
     `review-videos` Supabase bucket (canonical path) → insert
     `review_videos` row (service client)
   - `discardVideoRender` → no-op; rely on S3 lifecycle
4. Real admin route `baam-review/app/app/video-studio/…` — port the
   prototype (`docs/updated-plan/19-admin-video-studio.html`) to a Next
   route wired to the actions. Likely also a "Make video" entry point on a
   review in the reviews inbox + a Video **Library** view reading
   `review_videos`.
5. S3 lifecycle rule on the Remotion output bucket (auto-expire drafts).

### Step 3 — deploy & test end-to-end
Deploy the Lambda function + site against the AWS account, then:
composer → Generate (Lambda) → preview from S3 → Accept → MP4 in Supabase
`review-videos` bucket + `review_videos` row → shows in Library.

---

## Still-open product questions (decide during Phase 2)
- Auto-fetch source: business website scrape vs existing `locations` /
  `google_reviews` DB records (leaning **DB-first**, scrape as fallback).
- Review picker: live from `google_reviews` per location (one-click "make a
  video from this review" in the reviews inbox).
- Template variants: is Spotlight enough to launch, or build Quote Card /
  Minimal too?
- Hooks/phrases: human-authored vs AI-suggested from the review text
  (baam-review already has AI infra).
- Voiceover TTS provider (ElevenLabs is the natural fit) — `ReviewSpotlight`
  already supports a voiceover `audio` track; music is a new mix layer.
- Background-music licensing: curated royalty-free library vs upload-only.
- Decorative primitives not yet per-business themable (decor-variant layer).

---

## Key file map
- Template: `video-studio/videos/compositions/ReviewSpotlight.tsx`
- Types: `video-studio/videos/types.ts` · brand: `video-studio/videos/clinic/brand.ts`
- Architecture: `video-studio/videos/ARCHITECTURE.md`
- Render CLI: `video-studio/scripts/generate-video.mjs`
- Sample data: `video-studio/content/drhuang/reviews/sofia-degtyar.json`
- Migration: `baam-review/supabase/migrations/0021_review_videos.sql` (applied)
- DB types: `baam-review/lib/database.types.ts` (`review_videos`)
- UI prototype: `baam-review/docs/updated-plan/19-admin-video-studio.html`
- This doc: `baam-review/docs/operations/REVIEW_VIDEO_PROJECT.md`

## Not part of this project (separate, also parked)
SMS / Twilio A2P 10DLC — see `docs/operations/SMS_A2P_REGISTRATION.md`
(awaiting Twilio Business-Profile identity decision).
