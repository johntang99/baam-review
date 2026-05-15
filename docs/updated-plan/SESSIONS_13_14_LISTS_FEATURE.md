# Sessions 13 & 14 — Lists Feature Implementation

**Owner:** John Tang
**Status:** Ready for Claude Code
**Reference prototypes:** `_handoff/15-admin-lists.html`, `16-admin-list-intake.html`, `17-admin-list-presend.html`, `18-admin-list-detail.html`
**Estimated agent time:** 7–9 days total (3–4 days Session 13, 4–5 days Session 14)
**Dependencies:** Sessions 1–12 complete (BAAM Review v1 shipped, Resend & Twilio rails working, Supabase schema established)

---

## 1. Context: why this feature exists

BAAM Review v1 has a one-customer-at-a-time send form (`/app/send`). That's correct for self-serve owners sending the occasional request after a patient visit. It's wrong for the **managed service** — where John runs review collection on behalf of 5–10 clinics, each sending him a 30–60 patient list every week.

Without batch tooling, John's labor cost scales linearly: 50 customers × 30 seconds = 25 minutes of clicking per client per week. Across 10 managed clients that's 4+ hours weekly of pure data entry. By month 6 this collapses the managed service margin.

This feature replaces the linear-clicking workflow with a **list-based workflow** modeled on Mailchimp / Klaviyo:

1. **Import** a customer list (CSV / paste / manual)
2. **Review** the parsed list with per-row validation
3. **Send** in one batch
4. **Track** the lifecycle of every customer
5. **Resend** intelligently to non-responders after 5–14 days

End-state target: managed-service weekly labor per client drops from ~25 minutes to ~5 minutes. 8–10 managed clients become realistic for one person to operate.

---

## 2. Architecture decisions (locked before coding)

### 2.1 Database schema additions

Three new tables, all under existing Supabase Postgres. All tables include standard `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`. All FK columns include indexes. RLS policies match existing pattern (site-scoped via `site_id`).

```sql
-- LISTS table: one row per batch
create table lists (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  name text not null,                          -- "Week of May 12 · Patients"
  default_language text not null default 'en', -- en | zh | es
  status text not null default 'draft',        -- draft | sending | active | completed | archived
  customer_count integer not null default 0,   -- denormalized for fast list rendering
  sent_at timestamptz,                         -- null until first send fires
  completed_at timestamptz,                    -- null until user marks complete or auto-completed at 30 days
  max_touches integer not null default 2,      -- soft limit per customer
  notes text,                                  -- optional admin notes about this batch
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lists_site_id_idx on lists(site_id);
create index lists_status_idx on lists(status);
create index lists_sent_at_idx on lists(sent_at desc nulls last);

-- LIST_CUSTOMERS table: one row per customer per list
create table list_customers (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,  -- denormalized for RLS perf
  name text not null,
  email text,
  phone text,                                  -- E.164 format after normalization
  language text not null default 'en',         -- en | zh | es
  channel text not null default 'email',       -- email | sms
  visit_date date,
  notes text,                                  -- per-customer notes, flows to AI reply prompt
  status text not null default 'pending',      -- pending | sent | delivered | opened | clicked | reviewed | bounced | optout | excluded
  touches integer not null default 0,          -- count of send attempts (max = lists.max_touches)
  selected boolean not null default true,      -- false if user unchecked in pre-send screen
  excluded_reason text,                        -- 'duplicate_60d' | 'opted_out' | 'no_contact' | 'manual' | null
  send_request_id uuid references send_requests(id),  -- link to existing send_requests table for delivery tracking
  review_id uuid references reviews(id),       -- populated when customer completes a review
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index list_customers_list_id_idx on list_customers(list_id);
create index list_customers_site_id_idx on list_customers(site_id);
create index list_customers_status_idx on list_customers(status);
create unique index list_customers_dedup_idx on list_customers(site_id, email) where email is not null;
-- ^ NOTE: this unique index is intentional for the 60-day duplicate check (queried with date filter)

-- LIST_EVENTS table: timeline of state transitions for each customer
create table list_events (
  id uuid primary key default gen_random_uuid(),
  list_customer_id uuid not null references list_customers(id) on delete cascade,
  list_id uuid not null references lists(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  event_type text not null,                    -- sent | delivered | opened | clicked | reviewed | bounced | optout | resent
  metadata jsonb,                              -- {channel, touch_number, bounce_reason, etc}
  occurred_at timestamptz not null default now()
);
create index list_events_customer_id_idx on list_events(list_customer_id);
create index list_events_list_id_occurred_idx on list_events(list_id, occurred_at desc);

-- OPT_OUTS table: per-site permanent opt-out list (already exists in v1, just confirm structure)
-- contact (email or phone), site_id, opted_out_at
-- If it doesn't exist, create it now. Future lists will filter against this table.
```

**Why these specific shapes:**

- `list_customers.status` is the single source of truth for current state. `list_events` is the append-only history. UI reads `status` for the table, reads `list_events` for the touch-history timeline.
- `touches` denormalized on `list_customers` to avoid counting events on every render.
- `selected` allows users to uncheck rows in the pre-send screen without deleting them.
- `excluded_reason` is a string enum, not boolean, because we need to render *why* something was excluded (different UI per reason).
- Linking `send_request_id` to existing `send_requests` table preserves all the email delivery logic from v1.

### 2.2 Library choices

Pre-decided to avoid mid-session library debates:

- **CSV parsing:** `papaparse` (already in v1 for site config imports — reuse it)
- **Email normalization:** built-in regex; no library needed (just lowercase + trim)
- **Phone normalization:** `libphonenumber-js` (smaller than `google-libphonenumber`, sufficient for US)
- **Date display:** `date-fns` (already in v1) with `formatDistanceToNow` for "2 days ago"
- **Table sorting/filtering:** client-side only (lists never exceed ~500 rows), no library, just `.filter()` + `useMemo`
- **Form state:** Existing react-hook-form pattern from v1
- **Toast notifications:** existing `sonner` package

### 2.3 Conventions and patterns

- **All page components** under `/app/lists/` route. Server components by default; client components only where interactivity demands.
- **Server actions** for all mutations (create list, send batch, mark customer excluded, etc). No client-side API calls.
- **List status transitions** are server-only. Client never writes to `lists.status` directly — only via server actions that enforce valid transitions.
- **All times stored in UTC.** UI converts to user's timezone via existing `formatInTimezone` helper.
- **Phone format:** stored as E.164 (`+19175550234`), displayed as `(917) 555-0234`.
- **Language codes:** `en`, `zh`, `es` (lowercase ISO-639-1). Display: English, 中文, Español.
- **Existing `theme.json`** colors apply: forest green primary, gold accent, cream cream-deep backgrounds. No new tokens.

### 2.4 Routing structure

```
/app/lists                          → 15-admin-lists.html (index)
/app/lists/new                      → 16-admin-list-intake.html
/app/lists/[id]/review              → 17-admin-list-presend.html (pre-send)
/app/lists/[id]                     → 18-admin-list-detail.html (post-send detail)
```

The `[id]/review` route is the pre-send screen. After Send fires, it redirects to `[id]` which becomes the post-send detail view.

---

## 3. Session 13 — Schema, intake, draft state

**Goal:** A user can create a new list, import customers via paste / CSV / manual, validate it, and save it as a draft. No actual sending yet — that's Session 14.

**End-state demo:** John opens `/app/lists`, clicks "New list," pastes 12 tab-separated rows, sees the parsed preview with validations, fixes the missing email for Wei Zhang, clicks "Continue to review," sees all 12 customers in the pre-send table with per-row controls, clicks "Save as draft." He navigates back to `/app/lists` and sees the draft card. The Send button doesn't work yet (deferred to Session 14).

**Estimated effort:** 3–4 agent-days.

### 3.1 Phase gate 1 — Schema and types (30 min)

- Migration created: `supabase/migrations/[timestamp]_lists_feature.sql`
- All four tables created with indices, RLS, FK constraints exactly as Section 2.1
- TypeScript types generated and committed: `lib/database.types.ts` regenerated
- Empty `app/(admin)/lists/page.tsx` route exists that renders "Lists coming soon" — proves routing works
- **Done when:** `npm run typecheck` passes, you can navigate to `/app/lists` and see the placeholder

### 3.2 Phase gate 2 — Sidebar navigation update (15 min)

- Add "Lists" item to admin sidebar between "Send request" and "Reviews"
- New nav icon: clipboard-checked SVG (use Heroicons `clipboard-document-check`)
- Active state styling matches existing pattern
- Sidebar shows count badge with active+pending lists (e.g. "3")
- **Done when:** Sidebar matches the prototype's sidebar exactly across all four files

### 3.3 Phase gate 3 — Lists index page (4 hours)

Build `/app/lists` matching `15-admin-lists.html`:

- KPI stats strip with four metrics (Active / In-flight / Eligible for resend / Completion rate)
  - For now, computed from real data even if empty (zero state)
  - The "Eligible for resend" calculation: `count(distinct list_customer_id where status in ['sent','delivered','opened','clicked'] and touches < lists.max_touches and last_send_at < now() - interval '5 days')`
- Filter pills with counts (All / Active / Awaiting resend / Drafts / Completed)
- List cards rendered from real database; if empty, show empty state ("No lists yet. Click New list to import your first batch.")
- Each card shows: client tag, name, created/sent date, funnel visualization (or empty bars for drafts), next-action pill, source-client tag
- Cards are full-card clickable links to either `/lists/[id]/review` (if draft) or `/lists/[id]` (if sent)
- **Done when:** Page renders with proper styling, empty state works, the "New list" button navigates to `/app/lists/new`

### 3.4 Phase gate 4 — Create list metadata (2 hours)

Build the top of `/app/lists/new` matching `16-admin-list-intake.html`:

- Breadcrumb link back to Lists
- Page header with eyebrow "Step 1 of 2 · Import customers"
- Metadata card with three fields:
  - List name (text input, default: "Week of [date] · Patients")
  - Source client / location (select dropdown of all sites this admin has access to)
  - Default language (select: 中文, English, Español)
- Fields wired up to react-hook-form state; not yet submitted
- **Done when:** All three fields render and respond to input; default name auto-populates with today's date

### 3.5 Phase gate 5 — Three import method tabs (3 hours)

The three-tab interface for CSV / Paste / Manual:

- Tabs styled per prototype (active = forest underline, icon background = forest)
- Default active tab = **Paste from spreadsheet**
- Tab switching is purely client-side (useState), no routing change
- Each tab shows the appropriate input UI:
  - **CSV:** drag-drop zone + "Browse files" button; accepts .csv, .tsv. Reads file via `FileReader`. Parses via `papaparse`. Stores parsed rows in form state.
  - **Paste:** large monospace textarea. On paste or blur, parse via `papaparse` with `delimiter: 'auto'`. Stores parsed rows in form state.
  - **Manual:** Repeating row form with "Add another" button. Fields per row: name, email, phone, language, notes. Stores rows in form state.
- All three tabs write to the same form state shape: `{ rows: ParsedCustomerRow[] }`
- **Done when:** Pasting the sample data from the prototype into the paste textarea results in 12 rows in form state. CSV upload with the same data produces same result. Manual entry of 3 rows produces 3 rows in form state.

### 3.6 Phase gate 6 — Column mapping and preview (3 hours)

After rows are parsed, render the preview section:

- **Column mapping panel:** five labeled boxes showing detected columns (Name / Email / Phone / Language / Notes). Auto-detected from header row if present; otherwise positional.
- Each mapped column shows a green checkmark and the source column name.
- **Preview table:** renders all parsed rows with these columns: Name, Contact, Lang, Notes, Status.
- **Per-row validation:**
  - **Warning state (yellow row tint):** missing phone (still sendable via email-only) or unknown language (defaults to list default)
  - **Error state (red row tint, auto-excluded):** missing both email AND phone, OR duplicate (sent in last 60 days), OR opted-out contact
- **Validation strip below table:** summarizes warnings and exclusions in human-readable text
- **Action bar at bottom:** "Save as draft" (secondary) and "Continue to review" (primary)
- **Done when:** Pasting the prototype's sample data shows 12 rows in preview, Wei Zhang has a yellow tint with "No phone" badge, Mei Hong has a red tint with "Sent 14d ago" badge (mock the 60-day check by hardcoding her email as a known duplicate during Session 13; real lookup in Session 14)

### 3.7 Phase gate 7 — Save as draft / Continue to review (2 hours)

The server action that creates the list record:

- Server action `createList(formData)` validates input, creates `lists` row with status='draft', creates `list_customers` rows for each non-excluded row, sets `selected=true` by default, sets `excluded_reason` for excluded rows (still inserts them with `selected=false`)
- On success, redirects to either `/lists` (if "Save as draft" clicked) or `/lists/[id]/review` (if "Continue to review" clicked)
- Toast on success: "List created · 11 customers ready · 1 auto-excluded"
- **Done when:** Submitting the form creates a real `lists` row in Supabase with 12 `list_customers` rows attached. Refreshing `/app/lists` shows the new draft card.

### 3.8 Phase gate 8 — Pre-send review screen (4 hours)

Build `/app/lists/[id]/review` matching `17-admin-list-presend.html`:

- Page header with breadcrumb, eyebrow "Step 2 of 2", title, sub
- List meta bar showing list name, client, customers count, default language
- Table toolbar with: bulk-select checkbox, "N selected" count, filter pills (All / Ready / Excluded), bulk channel buttons (SMS all / Email all)
- Customer table with these columns:
  - Checkbox (controls `selected` field)
  - Customer name + visit date sub-line
  - Contact (email + phone, with mute styling if missing)
  - Channel toggle (SMS/Email segmented control; SMS disabled if no phone)
  - Language pill (EN / 中文 / ES)
  - Notes for AI (editable textarea; saves on blur to `list_customers.notes`)
  - Status badge (Ready / Email only / Sent 14d ago / etc)
  - Remove button (× icon — sets `selected=false`)
- All row edits trigger server actions to update the `list_customers` row
- Sticky bottom send bar with summary stats and three buttons:
  - "Save as draft" (secondary) — keeps current state, returns to `/lists`
  - "Send now" dropdown — opens a popover with "Send immediately" or "Schedule for [datetime]"
  - "Send to N customers" (primary, forest green)
- **The send button is wired but the action only logs intent in Session 13.** Real send happens in Session 14.
- **Done when:** Navigating to a draft's review page shows the 12 customers, you can uncheck rows, edit notes inline (and they persist on page refresh), toggle channels per row, click "Save as draft" to return to lists. Clicking "Send" shows a toast "Send not yet implemented — coming in Session 14."

### 3.9 Session 13 acceptance criteria

Before declaring Session 13 done, verify all of the following:

- [ ] Lists index page renders with real data, including empty state
- [ ] Sidebar shows "Lists" with badge count and active styling
- [ ] Creating a new list via paste-from-spreadsheet works end-to-end
- [ ] Column mapping correctly detects Name / Email / Phone / Language / Notes from sample data
- [ ] Wei Zhang shows yellow warning (no phone, email-only OK)
- [ ] Mei Hong shows red error (sent 14d ago, auto-excluded)
- [ ] Pre-send screen lets you uncheck, edit notes, toggle channels
- [ ] Notes saved per customer persist on page refresh
- [ ] "Save as draft" navigation works and the draft appears in the lists index
- [ ] Mobile breakpoint usable (test at 380px width)

---

## 4. Session 14 — Sending, tracking, and resend

**Goal:** The user clicks Send, emails fire via existing Resend rails, delivery events stream in via webhooks, the funnel UI updates as state changes, and the smart resend flow works end-to-end.

**End-state demo:** John opens the draft from Session 13, clicks Send to 11 customers. He waits 30 seconds and sees delivery events arriving. He navigates to the list detail page and sees the funnel showing 11 sent, 11 delivered, 0 opened. Over the next few minutes (simulated via test webhook calls), opens and clicks arrive. After 5+ simulated days, the list shows "8 eligible for resend" and clicking the smart filter shows exactly those 8 rows with gold "Resend" buttons. Clicking Resend fires a second-touch email to selected customers. The touch history sidebar shows both the original send and the resend with timestamps.

**Estimated effort:** 4–5 agent-days.

### 4.1 Phase gate 1 — Batch send action (4 hours)

Build the `sendList(listId)` server action:

- Validates list is in 'draft' status (can't send twice)
- For each `list_customer` where `selected=true` and `excluded_reason is null`:
  - Creates a `send_requests` row (reusing existing v1 send-request infrastructure)
  - Calls existing `sendReviewRequest` server action with the customer's email/phone/language
  - Updates `list_customers.send_request_id` with the new request ID
  - Updates `list_customers.status='sent'` and `touches=1`
  - Inserts `list_events` row with `event_type='sent'`, `metadata={channel, touch_number: 1}`
- Updates `lists.status='active'`, `lists.sent_at=now()`, `lists.customer_count=N`
- All inside a single transaction; rollback if any individual send fails
- Returns count of successful sends
- **Done when:** Clicking "Send to 11 customers" in the pre-send screen fires 11 send_requests (verify via Resend dashboard or test inbox), all 11 list_customers move to status='sent', the list moves to status='active', a redirect happens to `/lists/[id]` (post-send detail view)

### 4.2 Phase gate 2 — Webhook lifecycle tracking (3 hours)

The existing Resend webhook handler needs to update `list_customers.status` when relevant events arrive:

- Resend webhook payload includes the `send_request_id` we stored
- For each incoming webhook event, look up the `list_customer` via `send_request_id`
- Update `status` based on event type:
  - `delivered` → status='delivered'
  - `opened` → status='opened' (only if currently 'delivered' or below)
  - `clicked` → status='clicked' (only if currently 'opened' or below)
  - `bounced` → status='bounced', `excluded_reason='bounced'`
- For each event, also insert a row into `list_events` (append-only history)
- When a customer completes a review (existing review submission flow), find the matching `list_customer` via email lookup within the last 30 days, update `status='reviewed'`, link `review_id`
- **Done when:** Sending a test email and triggering Resend webhook events (or manually via Supabase studio) updates the list_customers status correctly. Submitting a review for one of the test customers also updates their status to 'reviewed'.

### 4.3 Phase gate 3 — List detail page header and funnel (3 hours)

Build the top half of `/app/lists/[id]` matching `18-admin-list-detail.html`:

- Page header with active-status pulsing green dot, list name, meta strip (client, customer count, last touch, max touches)
- Top actions: "Export CSV" and "Mark complete" buttons (Mark complete fires server action that sets `lists.status='completed'`, `completed_at=now()`)
- **Funnel hero card:**
  - Title "Lifecycle funnel" + sub "Click any stage to filter customers below"
  - Five clickable stage cards: Sent / Delivered / Opened / Clicked / Reviewed
  - Each shows count and percentage (count / total_sent × 100, rounded)
  - Active stage has forest border + shadow
  - Clicking a stage updates a URL query param `?filter=opened` and filters the table below
  - Five-segment progress bar at bottom of card
- All counts computed from real database state via efficient single query (aggregate over `list_customers`)
- **Done when:** Page header renders correctly with real data. Funnel shows correct counts. Clicking "Opened" filters the table to opened-but-not-clicked customers.

### 4.4 Phase gate 4 — Customer table on detail page (3 hours)

Build the customer table for `/app/lists/[id]`:

- Toolbar with bulk-select, six filter pills (All / Reviewed / Clicked-no-review / Opened-no-click / Not opened / Issues), eligibility filter
- Table columns: checkbox, customer name (with 中文 name first if present), channel + language, status pill, last action (with timestamp), action button
- Status pill variants:
  - Reviewed → green success-soft background
  - Clicked, no review → warn-soft background (yellow)
  - Opened, no click → sage background
  - Not opened → cream-deep background
  - Bounced → alert-soft background (red), checkbox disabled
  - Opted out → gray, checkbox disabled
- Last action column:
  - For reviewed: show review snippet ("5★ public review · \"sleeping through the night again\"") + sub line "Reviewed 1d ago"
  - For others: human-readable last event + relative time
- Action column:
  - For reviewed: "View review" link (success-green outline) → opens the review in a new tab
  - For eligible-for-resend: gold-bordered "Resend" button
  - For not-yet-eligible: disabled "Wait N more days"
  - For bounced/opted-out: disabled with reason text
- Row tinting: subtle gold background tint for resend-eligible rows
- **Done when:** Table renders with all real customer states correctly. Filter pills work. Resend-eligible rows are visibly distinct. Clicking a "View review" link opens the correct review.

### 4.5 Phase gate 5 — Smart resend filter and banner (2 hours)

The defining feature of the managed-service flow:

- Smart filter banner (dark ink gradient with gold lightning icon) renders above the customer table when ≥1 customer is eligible
- Banner text: "**N customers eligible for resend** · Past 5-day threshold · not yet reviewed · not opted out · under [max_touches]-touch limit. Send a precise second-touch email to the people who actually need a nudge."
- "Show eligible" button filters the table via `?filter=eligible` query param
- Eligibility query (server-side):
  ```sql
  select * from list_customers
  where list_id = $1
    and selected = true
    and status in ('sent', 'delivered', 'opened', 'clicked')
    and status not in ('reviewed', 'bounced')
    and excluded_reason is null
    and touches < (select max_touches from lists where id = $1)
    and id not in (select list_customer_id from list_events where event_type = 'resent' and occurred_at > now() - interval '5 days')
  ```
- **Done when:** Banner shows correct count of eligible customers. Clicking "Show eligible" filters table to just those rows.

### 4.6 Phase gate 6 — Resend action (3 hours)

Build the `resendToCustomers(listId, customerIds[])` server action:

- Validates each customer is in the eligible set (run the eligibility query, intersect with provided IDs)
- For each eligible customer:
  - Creates a new `send_requests` row (different ID than the original)
  - Calls `sendReviewRequest` with same channel/language as original
  - Updates `list_customers.touches += 1`, `send_request_id` to the new request ID
  - Resets `status='sent'` (so future webhook events update it again)
  - Inserts `list_events` row with `event_type='resent'`, `metadata={touch_number: 2}`
- Toast on success: "Resent to N customers"
- **Done when:** Clicking "Resend to selected" with 8 customers checked actually fires 8 new emails (verify in Resend dashboard or test inbox). The customers move back to status='sent' and their touches count = 2.

### 4.7 Phase gate 7 — Touch history sidebar (2 hours)

Build the right-column sidebar on `/app/lists/[id]`:

- "Touch history" header + sub "Every send event for this list"
- Vertical timeline rendered from aggregated `list_events`:
  - Group events by date and major action (First send, Delivery confirmed, First review, Nth review milestone, Resend, etc)
  - Active state (gold dot) for the most recent event
  - Future state (gray dot) for predicted "Second-touch eligible" date = oldest send + 5 days
- Below timeline, divider
- Five quick stats: Avg rating, Reviews in 中文, Avg time to review, Private feedback count, Pending AI replies
- Below that, an estimated impact card showing `count(reviewed) × $1,728` in big Fraunces serif numbers
  - The $1,728 number comes from the BAAM Review research report's Dr. Huang calculation
  - Site config can override per-site (different verticals have different per-review values per the research)
- **Done when:** Sidebar renders correctly with real data, timeline updates as new events arrive

### 4.8 Phase gate 8 — Polish and edge cases (3 hours)

The boring-but-critical work:

- **Empty states:** if a list has 0 customers, 0 sent, or 0 reviewed, render appropriate empty states everywhere
- **Loading states:** skeleton rows for the table during initial load
- **Error states:** if a send fails partially (8 of 11 successful), show partial-success toast + log the failures
- **Real-time updates:** Supabase realtime subscription on `list_customers` so the page updates without manual refresh as webhook events arrive
- **Pagination:** if a list has >100 customers, paginate the table (50 per page)
- **Phone number normalization:** any phone input is normalized to E.164 before storage; display formatted
- **Timezone handling:** all "X days ago" calculations use the site's configured timezone
- **Done when:** All four prototypes render and work correctly with edge case data; refresh-free updates work; mobile breakpoints OK

### 4.9 Session 14 acceptance criteria

Before declaring Session 14 done, verify all of the following:

- [ ] Clicking "Send to N customers" in pre-send screen fires N real emails (verify via Resend dashboard or test inbox)
- [ ] Webhook events from Resend update list_customers.status correctly
- [ ] Submitting a review from a list-sent recipient updates the corresponding list_customer to 'reviewed' with linked review_id
- [ ] Funnel hero card shows accurate counts that match the customer table
- [ ] Clicking a funnel stage filters the table to that subset
- [ ] Smart resend banner appears when ≥1 customer is eligible
- [ ] "Show eligible" filter shows exactly the customers matching the eligibility query
- [ ] Clicking Resend fires real second-touch emails and updates touches=2
- [ ] Touch history timeline renders correctly with active and future events
- [ ] Estimated impact card shows `count(reviewed) × per_review_value` with correct math
- [ ] Realtime updates: opening the page in two tabs, sending an event, both tabs update without refresh
- [ ] Mobile usable end-to-end (test at 380px)

---

## 5. Pre-answered questions (don't ask the user mid-session)

### Q: What if the user pastes data without a header row?

**A:** Auto-detect header by checking if row 1 has any cell that contains an `@` symbol (looks like an email). If yes, treat row 1 as data, not headers, and assign positional column mappings (Col 1 = Name, Col 2 = Email, Col 3 = Phone, etc). If row 1 looks like headers (no @, lowercase strings matching expected names), treat as headers.

### Q: How do we know if a phone number is valid?

**A:** Use `libphonenumber-js` `parsePhoneNumber(input, 'US')`. If it returns a valid number, store in E.164. If invalid, mark the row as "Invalid phone" warning, but still allow email-only send.

### Q: What's the 60-day duplicate check exactly?

**A:** When importing, for each row with an email or phone, run:
```sql
select 1 from list_customers
where site_id = $current_site
  and (email = $row_email or phone = $row_phone)
  and created_at > now() - interval '60 days'
  and status not in ('bounced', 'optout')
limit 1
```
If any row returns, mark as duplicate. Auto-exclude with `excluded_reason='duplicate_60d'`.

### Q: What language is the email sent in when a row has no language?

**A:** Falls back to `lists.default_language`, which falls back to `sites.default_language` if not set.

### Q: What happens when a list_customer has neither email nor phone after import?

**A:** Auto-excluded with `excluded_reason='no_contact'`. They're still inserted into list_customers for record-keeping, just with selected=false.

### Q: When does a list auto-complete?

**A:** Two conditions, whichever comes first:
1. 100% of selected customers have a terminal status (reviewed, bounced, or 2 touches with no review)
2. 30 days have passed since `sent_at`

Auto-complete sets `status='completed'` and `completed_at=now()`. User can also manually mark complete from the detail page.

### Q: What if a customer opts out via the SMS STOP reply or email unsubscribe?

**A:** Existing v1 opt-out handling already creates an `opt_outs` row. Add a trigger or webhook handler to also update `list_customers.status='optout'`, `excluded_reason='opted_out'` for any list_customer rows matching that email/phone within the past 90 days.

### Q: How do per-customer notes flow into AI reply prompts?

**A:** When a review is submitted and linked to a list_customer, the existing AI reply generation prompt receives an additional context field: `customer_context = list_customer.notes`. The prompt template (in `prompts/review-reply.txt` from v1) should be updated to: "If customer_context is provided, incorporate this context naturally when relevant: {customer_context}". Update the prompt only when this feature ships; not before.

### Q: Should we send emails immediately on "Send" click, or queue them?

**A:** Queue them in a background job (existing v1 has Supabase Edge Functions for delayed jobs). Reasons: (1) avoids timeout if user has 100+ customers, (2) allows scheduled-for-later, (3) gives clean rollback if any individual send fails. Use the existing `send_requests` queue infrastructure.

### Q: What if Resend webhooks are delayed or fail?

**A:** This is fine. The status field on list_customers is best-effort eventually-consistent. The funnel will catch up when webhooks arrive. If a webhook is permanently lost (rare), the customer's status may stay 'sent' forever — acceptable; manual override available via Supabase studio if it becomes an issue.

### Q: What about Twilio for SMS — same flow?

**A:** Yes, exact same flow. Twilio webhooks update the same `send_requests` row, the same list_customers status field. SMS events are: `delivered` (Twilio status_callback), `clicked` (Twilio link tracking, if enabled), `optout` (STOP reply). No `opened` event for SMS (not trackable).

### Q: Where does the estimated impact dollar amount come from?

**A:** Default value `$1,728` per review (Dr. Huang's number from the research report). Per-site override available via `sites.review_value_estimate` column (add a migration if not present). Future enhancement: prompt user to fill in their actual LTV during onboarding so each site's number is accurate. For Session 14, hardcoding the Dr. Huang value as fallback is fine.

### Q: How do we handle the Mei Hong test case in Session 13 if the 60-day check isn't built yet?

**A:** Hardcode `meihong88@163.com` as a known duplicate in the validation logic during Session 13 for prototype demonstration purposes. Remove the hardcode and use the real 60-day query in Session 14 phase gate 1.

---

## 6. What's explicitly out of scope

To keep these two sessions tight:

- **Auto-resend rules** (configurable per-list: "auto-resend at day 5") — defer to Phase 2
- **Scheduled sends** (send Monday at 9am) — defer to Phase 2; for Session 14 only "send now" works
- **Multi-list comparison views** (this batch vs last batch) — defer to Phase 3
- **PMS integrations** (auto-import from Dr. Huang's practice software) — defer to Phase 3
- **White-label client read-only views** (Dr. Huang's office manager logs in) — defer to Phase 3
- **AI-assisted note enrichment** ("Generate note suggestions from review history") — not needed
- **Bulk edit modes** (select 30 rows, change all to SMS) — Session 14 stretch goal if time permits, otherwise Phase 2
- **CSV export from the detail page** — Session 14 stretch goal (just `papaparse` reverse); not required for acceptance

---

## 7. Working with this plan

### Opening prompt for Session 13

Paste this into Claude Code at the start of Session 13:

> Read `_handoff/SESSIONS_13_14_LISTS_FEATURE.md` in full. We are starting Session 13 (schema, intake, draft state). Reference prototypes are in `_handoff/15-admin-lists.html`, `16-admin-list-intake.html`, `17-admin-list-presend.html`. Section 3 of the plan is your scope. Section 5 contains pre-answered questions — consult it before asking me. Confirm understanding, then begin Phase Gate 1.

### Opening prompt for Session 14

> Read `_handoff/SESSIONS_13_14_LISTS_FEATURE.md` in full. Session 13 is complete (verify against acceptance criteria in Section 3.9). We are starting Session 14 (sending, tracking, resend). Reference prototype: `_handoff/18-admin-list-detail.html`. Section 4 of the plan is your scope. Section 5 contains pre-answered questions — consult it before asking me. Confirm understanding, then begin Phase Gate 1.

### When the agent gets stuck

If Claude Code asks a question you didn't expect:
1. Check Section 5 of this doc first — many questions are pre-answered
2. If genuinely new, add the answer to Section 5 of this doc before continuing, so future sessions inherit the decision
3. If the question reveals a design flaw, pause Session 14 and revisit the prototypes

### When to ship

After Session 14 acceptance criteria all check, the feature is shippable to the first 1–2 managed customers as a private beta. Run the weekly flow for 2 weeks with real data. Issues will surface that this plan didn't anticipate. Iterate from there before declaring it ready for the public managed-service launch.

---

## 8. Connection to overall master plan

These two sessions slot into the master plan between Session 12 (Compound stage stub) and Session 15 (Stripe billing integration). After Session 14, the next priorities are:

- **Session 15:** Stripe billing integration with the new Concierge / Concierge Pro / Concierge Multi tiers (per `MANAGED_SERVICE_PRICING.md`)
- **Session 16:** Onboarding flow for managed customers (admin-facing setup wizard when adding a new managed client)
- **Session 17:** First managed-client production deployment (Dr. Huang Acupuncture as the founding-10 customer)

Sessions 13–14 are the technical prerequisite for the managed service to exist. Sessions 15–17 are the commercial prerequisites for the managed service to launch.
