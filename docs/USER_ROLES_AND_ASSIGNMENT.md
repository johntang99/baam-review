# BAAM Review — User Roles & Client Assignment Guide

This guide explains who can do what inside BAAM Review's internal admin, and how clients are assigned across the two Full-Service flows (Start Now and Regular Sales). Share with new staff during onboarding.

It is the BAAM Review companion to [baam-platform's guide](../../baam-platform/docs/USER_ROLES_AND_CLIENT_ACCESS_GUIDE.md) — the model here is intentionally simpler because BAAM Review only handles review ops, not the full GBP suite.

---

## 1) Who is who

### Single ops tenant

After migration 0032, **every BAAM staff member is a `users` row inside one shared `accounts` row** called "BAAM Operations" (`is_baam_internal = true`). Each customer (Self-Service / Full-Service) keeps their own personal `accounts` row (`is_baam_internal = false`).

Why: cross-staff assignment becomes a single column flip instead of cross-tenant data migration. All Start Now and Regular Sales connected locations live under BAAM Operations; visibility is filtered per-staff via `ops_role` + `location_assignments`.

### Internal vs customer accounts

Every login is either an **internal staff** or a **paying customer**:

- `accounts.is_baam_internal = true` → BAAM Operations (the one shared staff tenant).
- `accounts.is_baam_internal = false` → a customer (their own tenant, their own data).

Onboarding new staff happens at **`/app/admin/staff`** (admin-only). Two paths:
- **Invite** — sends a magic-link email; recipient sets a password on `/reset-password`, lands inside BAAM Operations.
- **Promote** — for someone who already signed up at `/signup`; moves them in, drops their personal account.

### Ops roles (internal staff only)

Internal staff have a `users.ops_role`. Three values — purpose, capabilities, and limits below.

| Role | Connect GBP? | Assign managers? | "All locations" view |
|---|---|---|---|
| **admin** | yes (uses shared `baamplatform@gmail.com` for Start Now) | any → any | every location |
| **sales** | yes (uses their own gmail in Regular Sales flow) | own clients → any account manager | locations they personally connected |
| **account_manager** | no | no | only locations a sales added them to |

A staff with `ops_role = NULL` is internal but has no role — they see everything in their account like an admin would, but won't appear in the Assign dropdown.

### Mapping back to baam-platform

| BAAM Review | baam-platform |
|---|---|
| admin | Admin / Super Admin |
| sales | Director |
| account_manager | Manager |

BAAM Review has no "Assistant" or "Branch" concept yet — those can come later if the team grows past the point where the flat model holds.

---

## 2) The two Full-Service flows

### Flow A — Start Now (customer pays first)

1. Customer hits **Start now** on `/pricing`.
2. Stripe Checkout: 30-day trial, card saved. Webhook creates a `customer_records` row in `pending_gbp_connect`.
3. Customer adds **`baamplatform@gmail.com`** as a Manager on their Google Business Profile.
4. **Admin** (John) accepts the Google invite, opens **`/app/onboarding`**, clicks "Connect their GBP". The picker uses admin's OAuth token, creates the location, links it back to the `customer_record`, and writes the Stripe sub to `location_subscriptions`.
5. Admin then opens the new location on `/app/locations`, clicks **Assign**, and picks an account manager (M-1 … M-5) who will run daily work.

**Who connected:** admin. `locations.connected_by_user_id = admin.user_id`.
**Who manages:** whichever account manager was assigned.
**Who sees the client:** admin (always), the assigned account manager(s).

### Flow B — Regular Sales (sales acquires + charges)

1. Sales S-N acquires client C-N offline (no Start Now Stripe flow).
2. Client adds **S-N's own gmail** as a Manager on their GBP. Client gives S-N a credit card.
3. S-N logs into BAAM Review, connects GBP via the picker. The picker uses S-N's OAuth token.
4. S-N sets up Stripe billing for the location through the existing Full-Service billing flow.
5. If S-N doesn't want to run daily ops themselves, they open the location and click **Assign** → pick account manager M-N → done. The client now also appears in M-N's All locations.

**Who connected:** S-N. `locations.connected_by_user_id = S-N.user_id`.
**Who manages:** S-N alone (if no assignment), or S-N + the assigned manager(s).
**Who sees the client:** S-N (always, as connector), the assigned account manager(s), admin.

### What both flows share

- The location's `connected_by_user_id` is **immutable** — set once at connect time, used forever as "who owns the relationship".
- Assignment is **additive**, not a transfer. The connector never loses visibility.
- Assignment is **optional**. If a sales wants to run the client themselves, they just don't open the Assign modal.

---

## 3) Visibility rules — what each role sees on `/app/locations`

The same query rule applies everywhere a "list of clients" appears (sidebar, dashboard, picker, settings switcher):

| Your `ops_role` | A location shows up when |
|---|---|
| `admin` (or NULL) | always (within your account) |
| `sales` | `locations.connected_by_user_id = your.user_id` |
| `account_manager` | a `location_assignments` row exists with `user_id = your.user_id` |
| (not internal) | account-scoped RLS — you see only your own business |

The "All locations" card shows a small **"Managed by …"** subtitle listing the account managers currently assigned, so the connector can tell at a glance who's running each client.

---

## 4) Assignment workflow

### Assignment rules at a glance

| Question | Admin | Sales | Account manager |
|---|---|---|---|
| Can click Assign on a client card? | Yes — any client | Yes — only clients they connected | No, button is hidden |
| Who appears in the Assign dropdown? | Every account_manager | Every account_manager | — |
| Can BE assigned as a manager? | No | No | Yes — only eligible role |
| Can remove an assigned manager? | Yes — any client | Yes — only clients they connected | No |
| Can reassign to a different manager? | Yes — remove + add in modal | Yes — only own clients | No |
| What changes after the assignment lands? | Nothing (admin sees all) | Nothing — connector sees the client forever | Client appears in their All locations; can do daily ops |
| Notification on being assigned? | — | — | No automatic email — sales tells them in person |

### Who may click Assign on a card

| Card belongs to | admin can assign? | sales can assign? | account_manager can assign? |
|---|---|---|---|
| A client **they** connected | yes | yes | no (button hidden) |
| A client **someone else** connected | yes | no (button hidden) | no |

### Who may be assigned

Only users with `ops_role = 'account_manager'` appear in the dropdown. Admins and other sales are never assignable — they're not the audience for daily ops work.

### Effect of an assignment

- New row in `location_assignments(location_id, user_id, assigned_by_user_id, assigned_at)`.
- The account manager sees the client in their **All locations** immediately on next page load. No email notification — the sales tells them in person (per team agreement).
- The connector (sales or admin) still sees the client as before.
- A single client can have multiple account managers added over time (e.g., a primary + a backup).

### Removing a manager

In the Assign modal, click the trash icon next to a current assignment to remove. Same authorization as assigning: admin can remove any; sales can only act on their own connected clients.

### Reassigning to a different manager

There is no "reassign" — just add the new manager and remove the old one. Two clicks, no special workflow.

---

## 5) Staff lifecycle

### Onboarding a new staff member

1. New staff signs up via **`/signup`** like any other user. They get their own `accounts` row (default `is_baam_internal = false`) and `users` row (default `ops_role = NULL`).
2. An existing internal user opens **`/app/admin/staff`**, types the new staff's email into "Promote an existing account", clicks **Promote**. The account flips to `is_baam_internal = true` and a role dropdown appears.
3. Pick the right role — **Sales** for someone who'll connect GBPs, **Account manager** for someone who'll only do daily ops, **Admin** if they need full visibility.

If the email isn't found, you'll see "No account found — ask them to sign up at /signup first." That means step 1 hasn't happened yet.

### Changing someone's role

On `/app/admin/staff`, change the dropdown next to their row. Saves immediately. Existing client assignments are not affected — only future visibility is.

### Off-boarding

On `/app/admin/staff`, click **Remove** next to the staff's row. This:

- Sets `accounts.is_baam_internal = false` (they lose the BAAM Operations sidebar section).
- Wipes `ops_role` on every user under that account.
- Does **not** remove their existing `location_assignments` rows. To clean those up too, open each location they were assigned to and Remove them from the Assign modal — or run an SQL cleanup if there are many.

Self-protection: you cannot demote your own account. Ask another internal user to do it.

---

## 6) Sidebar tabs by role

| Tab | admin | sales | account_manager | customer |
|---|---|---|---|---|
| Dashboard | yes | yes | yes | yes |
| Send review request | yes | yes | yes | yes |
| Lists | yes | yes | yes | yes |
| Reviews Reply & Share | yes | yes | yes | yes |
| Reward & Referral | yes | yes | yes | yes |
| Widget & QR | yes | yes | yes | yes |
| Analytics | yes | yes | yes | yes |
| Settings | yes | yes | yes | yes |
| Billing | yes | yes | yes | yes |
| Roles & access | yes | yes | yes | no |
| **BAAM Operations → Onboarding queue** | yes | yes | no | no |
| **BAAM Operations → Staff access** | yes | no | no | no |

Sidebar item rendering rules (enforced in [components/admin/sidebar.tsx](../components/admin/sidebar.tsx)):
- The **BAAM Operations** section only appears for users with `ops_role IN ('admin', 'sales')`.
- **Onboarding queue** appears for admin + sales; account_manager doesn't see it. Account managers don't connect GBPs, and the queue contains pending-customer PII.
- **Staff access** appears for admin only. Sales and account managers cannot invite or change staff.
- **Roles & access** (this page) appears for any internal user — a quick reference for what your role can do.

In addition to hiding sidebar items, each route also enforces its own server-side gate, so typing a URL directly still bounces you to `/app` if your role doesn't match.

---

## 7) Permissions cheat sheet

| Capability | admin | sales | account_manager |
|---|---|---|---|
| Invite/promote/demote internal staff | yes | no | no |
| Set another user's ops_role | yes | no | no |
| See Onboarding queue (Start Now pending) | yes | yes | no |
| Click "Connect their GBP" from queue | yes | yes (uses own gmail) | no |
| Connect a GBP via Locations → Connect Google | yes | yes | no |
| Assign account managers to a client | yes (any) | yes (own connected) | no |
| Remove account manager from a client | yes (any) | yes (own connected) | no |
| See client billing details | yes (any) | yes (own connected) | yes (own assigned) |
| Manage client billing (Set up / Manage card / Invoice) | yes (any) | yes (own connected) | yes (own assigned) |
| Reply to reviews, run review batches, edit settings | yes (any) | yes (own connected) | yes (own assigned) |
| Change own password | yes | yes | yes |

---

## 7.1) Data scoping per page

Every workspace page applies the same role-based filter via `getVisibleLocationIds(supabase, internal)` ([lib/auth/staff.ts](../lib/auth/staff.ts)). That function returns:
- `null` for admin / customer logins (no extra filter — RLS handles tenant scoping).
- `[location_ids]` for sales (locations where `connected_by_user_id = me`).
- `[location_ids]` for account_manager (locations in `location_assignments` for me).

Pages that apply it (every metric / row / dropdown filtered accordingly):

| Page | What gets filtered |
|---|---|
| `/app` (Dashboard) | every funnel, AI reply queue, revenue card |
| `/app/locations` | location grid, Assign button visibility, "Managed by" subtitle |
| `/app/locations/[id]` and all subroutes | route-level redirect to `/app/locations` if user can't access |
| `/app/send` | location picker shows only what they can send for |
| `/app/lists` | list rows + cross-location filter |
| `/app/reviews` | private feedback, completed click-throughs, Google reviews |
| `/app/referrals` | reward + referral config, falls back to first visible location |
| `/app/share` | widget builder, falls back to first visible location |
| `/app/analytics` | every metric query and revenue location |
| `/app/billing` | billing line per client + Set up / Manage / Invoice action gating |

The pattern is identical — single helper, applied at the page level. Server actions that target a single location additionally call `canAccessLocation(...)` so direct POSTs with another location's id are rejected.

---

## 8) Worked examples

### Example A — Start Now, admin assigns

- Customer "Joy's Express" signs up Start Now → `customer_records` row appears in `/app/onboarding`.
- **John (admin)** accepts the GBP manager invite, clicks "Connect their GBP" → location created with `connected_by_user_id = John`.
- John opens the location, clicks **Assign**, picks **M-1 (Sarah)**.
- Result: John sees the location (admin). Sarah sees it in her All locations. No one else does.

### Example B — Regular Sales, sales runs solo

- **S-2 (Mike)** acquires "Brooklyn Vein Clinic" offline. Client adds Mike's gmail to GBP. Mike charges card via Stripe.
- Mike logs in, picker uses Mike's OAuth token, location created with `connected_by_user_id = Mike`.
- Mike does daily ops himself. He never clicks Assign.
- Result: Mike sees the location. John (admin) sees it. No account manager sees it.

### Example C — Regular Sales, sales delegates

- **S-1 (Alice)** acquires 30 clients with her gmail.
- For 20 of them, she opens each location → **Assign** → picks **M-6 (Diego)**.
- Result: Alice still sees all 30 (always — connector visibility). Diego sees the 20 assigned to him. Alice's other 10 are invisible to Diego.

### Example D — Multiple managers on one client

- A high-touch client needs both English and Spanish review handling.
- S-3 connects the GBP, then **Assign** → picks **M-4** (English specialist). Then opens Assign again → picks **M-7** (Spanish specialist).
- Result: S-3, M-4, M-7 all see the client. The card shows "Managed by M-4, M-7".

---

## 9) Edge cases

- **Sales tries to assign a client they didn't connect.** Button is hidden. If they POST the form directly anyway, the server rejects with "You can only assign managers to clients you connected".
- **Sales tries to pick a non-account-manager from the dropdown.** Dropdown only shows users with `ops_role = 'account_manager'`. If the role changes mid-flow, the server rejects with "Selected user is not an account manager".
- **Account manager visits `/app/locations/<id>` for a location not assigned to them.** Account-scoped RLS still applies, so they get the page but with no review/list/reward data (or, if outside their account entirely, a not-found). The list page won't link them there in the first place.
- **An account has zero users.** The role dropdown on `/app/admin/staff` is disabled with the tooltip "No user under this account yet". Rare — usually a user appears immediately on signup via the `handle_new_user` trigger.

---

## 10) Where this lives in the code

| Concern | File |
|---|---|
| Schema: ops_role + connected_by_user_id + location_assignments | [supabase/migrations/0031_staff_assignment.sql](../supabase/migrations/0031_staff_assignment.sql) |
| Schema: consolidate to one ops tenant + per-user OAuth | [supabase/migrations/0032_unify_ops_tenant.sql](../supabase/migrations/0032_unify_ops_tenant.sql) |
| Schema: backfill legacy `connected_by_user_id` | [supabase/migrations/0033_backfill_legacy_connected_by.sql](../supabase/migrations/0033_backfill_legacy_connected_by.sql) |
| All role + visibility helpers | [lib/auth/staff.ts](../lib/auth/staff.ts) |
| Per-user OAuth token fetch / refresh | [lib/google/business-profile.ts](../lib/google/business-profile.ts) |
| Per-user review sync | [lib/google/sync-reviews.ts](../lib/google/sync-reviews.ts) |
| Picker captures `connected_by_user_id` | [app/app/locations/connect/picker/actions.ts](../app/app/locations/connect/picker/actions.ts) |
| Locations list + filter + Assign button | [app/app/locations/page.tsx](../app/app/locations/page.tsx) |
| Assign / unassign actions | [app/app/locations/assignments/actions.ts](../app/app/locations/assignments/actions.ts) |
| Assign modal UI | [app/app/locations/assignments/assign-manager-modal.tsx](../app/app/locations/assignments/assign-manager-modal.tsx) |
| Staff admin page + Invite/Promote/Demote actions | [app/app/admin/staff/](../app/app/admin/staff/) |
| Auth callback (hash/code/token_hash handling) | [app/auth/callback/page.tsx](../app/auth/callback/page.tsx) |
| Sidebar role-gated section | [components/admin/sidebar.tsx](../components/admin/sidebar.tsx) |
| Onboarding queue (admin + sales) | [app/app/onboarding/page.tsx](../app/app/onboarding/page.tsx) |
| Billing visibility + action gates | [app/app/billing/](../app/app/billing/) |
| Settings (per-user email, role, change password) | [app/app/settings/](../app/app/settings/) |
| Roles & access reference (this guide in-app) | [app/app/roles/page.tsx](../app/app/roles/page.tsx) |

---

## 11) FAQ

**Q. Can a sales reassign a client to another sales?**
No. Only account managers can be assigned. If you need a hand-off between sales, ask admin.

**Q. Can an account manager promote themselves to sales?**
No. Role changes are admin-only via `/app/admin/staff`.

**Q. What if the GBP manager email needs to change (e.g., a sales leaves)?**
Today: the new sales has to be added as a manager on the client's GBP separately by the client, then they re-run the picker. The location's `connected_by_user_id` is immutable, so the original sales would still appear as connector — that's accurate as audit, even if they no longer work the account. If you want the visibility to move, ask admin to update `connected_by_user_id` directly via SQL.

**Q. Do account managers see the Onboarding queue?**
Yes — they can see paid-but-not-yet-connected Start Now customers. They can't click "Connect their GBP" (they don't have admin's gmail token), so the button is informational for them.

**Q. Is there a notification when I'm assigned?**
No automatic email — the sales tells you in person. This was a deliberate choice for the current team size. If the team grows past where in-person communication scales, we'll add email.
