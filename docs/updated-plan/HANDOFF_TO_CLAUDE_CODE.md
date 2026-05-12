# Handoff to Claude Code — BAAM Review v2.0

**For:** John Chen
**Goal:** Get from "the prototypes are done" to "Claude Code is running Session 1" in under 30 minutes.

---

## What this document is

A single execution checklist. Three parts:
1. **Stage the files** (10 min)
2. **Verify prerequisites are met** (5 min)
3. **The exact prompt to paste into Claude Code** (1 min — at the bottom of this doc)

If something in part 2 isn't ready, **don't start the session.** It's cheaper to fix prerequisites than to recover mid-session.

---

## Part 1 — Stage the files (10 min)

### 1.1 Copy the docs into the codebase

From `/mnt/user-data/outputs/` (or wherever you downloaded them), move all 16 files into a single staging folder. The destination is `~/dev/baam-monorepo/clients/baam-review/_handoff/`.

Use this terminal command if you're on macOS:

```bash
# Adjust the source path to wherever you downloaded the files
SOURCE=~/Downloads/baam-review-v2
DEST=~/dev/baam-monorepo/clients/baam-review/_handoff

mkdir -p $DEST
cp $SOURCE/*.md $SOURCE/*.html $DEST/

# Verify
ls $DEST | sort
```

You should see exactly **16 files**:

```
01-marketing-home.html
02-marketing-pricing.html
03-admin-dashboard.html
04-admin-send-request.html
05-review-questions.html
06-review-ai-draft.html
07-review-thankyou.html
08-staff-mode.html
BAAM_REVIEW_MASTER_PLAN.md
BRAND_ASSETS.md
HANDOFF_TO_CLAUDE_CODE.md      ← this file
LAUNCH_CHECKLIST.md
OUTREACH_SCRIPTS.md
PRE_SESSION_1_SETUP.md
SESSIONS_3_TO_12_BRIEFS.md
SESSION_1_BRIEF.md
SESSION_2_BRIEF.md
```

If you have more or fewer, stop and reconcile.

### 1.2 Confirm the parent folder structure

```bash
cd ~/dev/baam-monorepo
ls clients/
```

You should see your existing `baam`, `baam-local`, `Baam-Utilities` folders plus the new `baam-review` folder containing `_handoff/`. The `clients/baam-review/` folder itself is otherwise empty — Claude Code will fill it during Session 1.

### 1.3 Create the working branch

```bash
cd ~/dev/baam-monorepo
git checkout -b feature/baam-review-session-1
git add clients/baam-review/_handoff/
git commit -m "chore(baam-review): stage v2.0 handoff docs"
```

This commit gives Claude Code a clean starting point and creates the audit trail.

---

## Part 2 — Prerequisite check (5 min)

Walk through this list. **Every red ⛔ must be ✓ before starting the session.** Yellow ⚠️ are recommended but not strictly blocking; green ✅ are deferred to future sessions.

### ⛔ Blockers (must be done)

- [ ] **DNS:** `dig review.baamplatform.com CNAME +short` returns `cname.vercel-dns.com`
- [ ] **Supabase:** `baam-review-prod` project exists; you have URL, anon key, and service role key in 1Password
- [ ] **Supabase auth:** Site URL set to `https://review.baamplatform.com`; redirect URLs include both production and `localhost:3000`
- [ ] **Google OAuth:** New client for BAAM Review created in the existing `baam-platform` GCP project; Client ID + secret pasted into Supabase auth providers
- [ ] **Supabase CLI:** Installed locally, logged in, linked to `baam-review-prod`
- [ ] **Node 20 + npm 10:** `node -v && npm -v` shows correct versions
- [ ] **Monorepo:** On a clean `feature/baam-review-session-1` branch with the `_handoff/` commit
- [ ] **Vercel:** Has GitHub access to your monorepo (you'll create the project during Gate 4)

### ⚠️ Async items (file now even though they're not blocking Session 1)

- [ ] **Twilio A2P 10DLC application:** Filed today if not already. 2–4 week wait. Without this, Session 4's SMS sending will be throttled.
- [ ] **Stripe products + prices:** Created with the 9 price IDs from `PRE_SESSION_1_SETUP.md` section 5. Saves time in Session 7.
- [ ] **Founding 50 list:** Started in Notion/Airtable. Target 30 warm leads by Session 12. See `LAUNCH_CHECKLIST.md` for the tier breakdown.

### ✅ Deferred (don't do now)

- [ ] Resend domain setup (Session 4)
- [ ] Anthropic API key provisioning (Session 5)
- [ ] Email DNS records (Session 4)
- [ ] Production launch announcements (after Session 12)

**Full prerequisites doc:** `_handoff/PRE_SESSION_1_SETUP.md`

If anything in the ⛔ list is missing, **stop here**, fix it, then resume. Trying to power through prerequisites mid-session creates more pain than waiting half a day.

---

## Part 3 — The opening prompt for Claude Code (1 min)

Once Part 1 and the ⛔ items in Part 2 are green, open Claude Code:

```bash
cd ~/dev/baam-monorepo
claude-code
```

Paste **exactly this prompt** as your first message. Don't paraphrase, don't add context above it, don't customize:

---

````
You are picking up a build that has extensive prep work already done. Before you do anything else, read these files in this exact order from clients/baam-review/_handoff/:

1. SESSION_1_BRIEF.md — your primary instructions for this session
2. BAAM_REVIEW_MASTER_PLAN.md — the architectural and product source of truth
3. BRAND_ASSETS.md — the design token system you must use
4. The eight HTML prototypes (01 through 08) — design source of truth; reference these as you build matching React components

Then verify the prerequisites the brief mentions are met:

- DNS for review.baamplatform.com resolves to cname.vercel-dns.com
- Supabase project baam-review-prod exists and we have env vars
- Google OAuth client is configured with the correct redirect URIs
- We're on branch feature/baam-review-session-1 inside ~/dev/baam-monorepo

If any prerequisite isn't verifiable from inside this session, ask me before proceeding. Don't assume.

When you're ready to begin Gate 1 of Session 1:

1. Confirm out loud that you've read all four primary documents
2. List the things you've understood as in-scope vs explicitly out-of-scope for this session
3. Wait for me to type "go" before you write a single file

Critical constraints, restating from the brief:

- Build only in clients/baam-review/. Never modify other clients folders.
- Stop at each of the four gates and wait for "go." Don't roll gates together.
- Don't install packages outside the stated stack.
- Don't invent design tokens. The prototypes and BRAND_ASSETS.md are the system.
- Don't build features beyond Session 1 scope, even if it would "save time later." Resist this strongly.
- Copy the eight prototypes to clients/baam-review/_prototypes/ during Gate 1 so they're co-located with the codebase you're building.

After each gate, report in this format:
- Gate name + time spent
- Files added or changed (paths, no diff)
- Checklist results (✓ or ✗ for each gate criterion)
- Anything blocking
- Decisions you made that I should know about
- "Ready for Gate N+1" or what you need from me

Under 400 words per report.

Begin by reading the files. Confirm understanding. Wait for "go."
````

---

After Claude Code reads the briefs and reports back, type **`go`** to start Gate 1.

---

## Part 4 — What happens next

Session 1 runs for 6–8 hours total, split across the 4 gates with pauses in between. You don't need to be at the keyboard the whole time — just available at each pause for ~15 min of review.

Realistic timing:
- **Gate 1** (~1 hr): Project bootstrap. You confirm. Type "go."
- **Gate 2** (~1.5 hr): Supabase + full schema deployed. You verify the migration ran clean. Type "go."
- **Gate 3** (~2 hr): Auth flows + locations CRUD. You sign up with email and Google to verify. Type "go."
- **Gate 4** (~2 hr): Admin shell + marketing pages + Vercel deploy. You hit `https://review.baamplatform.com` and confirm it's live.

After Gate 4, the session is done. Merge the branch to `main`. The next session brief lives at `_handoff/SESSION_2_BRIEF.md` — use the same handoff pattern.

---

## Part 5 — When things go sideways

The most common Session 1 failure modes and how to handle them:

### "Gate 2 migration fails with extension/syntax error"

Most likely: missing `pgcrypto` extension in Supabase. Tell the agent: "The migration failed. Read the error, fix the SQL, and re-run `npx supabase db reset` against the local instance. Don't push to production until local passes."

### "Gate 3 Google OAuth returns redirect_uri_mismatch"

You missed a redirect URI in the Google Cloud console. Add this exact URL: `https://<your-supabase-ref>.supabase.co/auth/v1/callback`. Supabase's OAuth callback is separate from your app's callback.

### "Gate 4 Vercel deploy fails on custom domain"

DNS hasn't propagated. Run `dig review.baamplatform.com CNAME +short` to confirm. If it returns the right value but Vercel still won't attach, wait 30 minutes and retry. Don't proceed to verification until SSL is issued.

### "Agent is doing something I didn't ask for"

Stop it. Type: "Pause. Read the constraints section of SESSION_1_BRIEF.md again. Confirm you understand we're building only Session 1 scope. List what you were about to do and why."

Agents drift. The cure is referring back to the brief.

### "Agent is asking permission for every small decision"

Tell it: "You have authority to make implementation decisions within the stated stack and gate scope. Only pause when you hit ambiguity in the brief itself, when you need data I have to provide (env vars, credentials), or at gate boundaries."

---

## Part 6 — Between sessions

After Session 1 merges to `main`:

1. **Update the staged docs.** If you've learned something during Session 1 that changes plans for Session 2 (a schema decision, a routing convention, an unexpected library choice), update `_handoff/SESSION_2_BRIEF.md` before you start it.
2. **Work the founding 50 list.** `LAUNCH_CHECKLIST.md` part "Pre-launch — T-minus 2 weeks" — start building this list in week 1 alongside the agent work, not after.
3. **Check Twilio status.** A2P 10DLC takes 2–4 weeks. By Session 4 you need approval, so monitor it weekly.

The doc you'll re-read most often during this build is `LAUNCH_CHECKLIST.md`. The doc you'll re-read most often during coding is `BAAM_REVIEW_MASTER_PLAN.md`. The doc the agent re-reads most often is the current `SESSION_N_BRIEF.md`.

---

## One last thing

Don't paraphrase the opening prompt. The wording is calibrated to set the right constraints from sentence one. Agents internalize the framing of how they're first addressed — start them with discipline and they stay disciplined. Start them with hand-waving and you'll be wrestling them back to scope for 12 weeks.

You've done the planning work. The first few minutes of Session 1 — making sure the agent reads the briefs and waits for "go" — is the moment the planning pays off.

**Begin when ready.**
