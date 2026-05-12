# Sidebar Location Switcher — Rules

*Single source of truth for how the left-sidebar location switcher behaves. If you change it, change this doc.*

---

## Concept

Two distinct selectors with non-overlapping purposes:

| Selector | Purpose | Where it lives | What it controls |
|---|---|---|---|
| **Sidebar switcher** | Workspace context — "which location's data am I looking at when I click Dashboard / Send / Reviews / Analytics / Embed & QR" | Top of the sidebar | A cookie: `baam_selected_location_id` |
| **In-content picker** | Which location I'm currently editing on a management page | At the top of `/app/locations/[id]/*` | The URL `[id]` segment |

The two are intentionally independent. Clicking on a card in `/app/locations` does not change the sidebar. Switching the in-content picker does not change the sidebar.

---

## Rule R1 — What the button displays

The sidebar button reads from the cookie state only. **It does not auto-change based on URL.**

| Cookie state | Icon | Top line | Subtitle |
|---|---|---|---|
| Specific location ID | Location's logo (or brand-color initial) | Location name | Location address (or "—") |
| Null / unset | LayoutGrid icon | **Manage all locations** | "{N} locations" |

**Code location:** [`components/admin/location-switcher.tsx`](../components/admin/location-switcher.tsx) — the button JSX, lines around the `selected ?` ternary.

---

## Rule R2 — Which item is "selected" in the dropdown

Same source of truth as R1: the cookie value. The check mark follows it.

| Cookie state | Item with check mark |
|---|---|
| A specific location's ID | That location's entry |
| Null / unset | "Manage all locations" entry |
| (any) | "Connect a new location" is **never** checked — it's a navigation action, not a state |

---

## Rule R3 — Picking a specific location

```
1. POST /api/select-location with { value: "<location-id>" }
   → cookie baam_selected_location_id set to that ID
2. Decide where to navigate:
   - If pathname matches /app/locations or /app/locations/<id>/*  → router.push("/app")
   - Otherwise (workspace page)                                   → router.refresh()
3. Close the dropdown.
```

Workspace pages (which `router.refresh()` works on) re-fetch with the new cookie value and scope their data accordingly.

---

## Rule R4 — Picking "Manage all locations"

```
1. POST /api/select-location with { value: null }
   → cookie baam_selected_location_id is deleted
2. router.push("/app/locations")    (always; unconditional)
3. Close the dropdown.
```

Rationale: this item combines two intentions:
- Clear the workspace selection ("I'm not focused on one location right now")
- Navigate to the management hub ("Let me see all of them")

Both happen together.

---

## Rule R5 — Picking "Connect a new location"

```
1. Navigate to /api/auth/google/start  (a Next.js <Link>)
2. Cookie unchanged.
3. Close the dropdown.
```

After OAuth completes and the user picks a place, they land on `/app/locations/connect/picker` → `/app/locations`. The cookie is whatever it was before they started.

---

## Rule R6 — URL navigation never changes the cookie

This is the inverse of R1: just as the button doesn't auto-change with URL, the cookie isn't auto-changed by navigation. The cookie only changes via:

- An explicit pick from the sidebar dropdown (R3, R4)

Things that explicitly do **not** change the cookie:

- Clicking a location card on `/app/locations`
- Using the in-content location picker on `/app/locations/[id]/*`
- Navigating between workspace pages
- The Google OAuth connect flow

---

## Rule R7 — Per-page behavior with the cookie

How each page reacts to the selected-location cookie:

| Route | Reads cookie? | Behavior when cookie has a location | Behavior when cookie is null |
|---|---|---|---|
| `/app` (Dashboard) | ✅ | Scope all metrics to that location | Aggregate across account's locations |
| `/app/send` | ✅ | Pre-select that location in the form | Default to first location |
| `/app/reviews` | ✅ | Filter to that location | Show all (Google + private + click-throughs) |
| `/app/analytics` | ❌ | (always aggregate) | (always aggregate) |
| `/app/share` | ✅ | Show QR / embed for that location | Fall back to most recently created location |
| `/app/settings` | ❌ | Account info, not location-scoped | Same |
| `/app/billing` | ❌ | Account info | Same |
| `/app/locations` | ❌ | List all locations regardless | Same |
| `/app/locations/[id]/*` | ❌ | Uses URL `[id]`, ignores cookie | Same |

**The cookie is workspace context. Pages that aren't part of workspace ignore it.**

---

## Rule R8 — Stale-cookie defense

If the cookie holds a location ID that no longer exists (e.g., the user deleted that location in another tab), the admin layout treats it as null:

```ts
// app/app/layout.tsx
const validSelectedId = locations?.some((l) => l.id === selectedLocationId)
  ? selectedLocationId
  : null;
```

So a stale cookie can't break workspace pages — they fall back to aggregate.

---

## Test plan

### Code-level checks
- TypeScript compiles
- Production build succeeds
- All routes register

### Behavioral checks (manual or scripted)

| # | Action | Expected sidebar button | Expected URL |
|---|---|---|---|
| T1 | Fresh state (no cookie) | "Manage all locations · N locations" | (any) |
| T2 | Pick Dr. Huang from a workspace page | "DR. Huang Acupuncture…" | (unchanged) |
| T3 | Pick Dr. Huang from `/app/locations` | "DR. Huang Acupuncture…" | `/app` |
| T4 | Pick "Manage all locations" from anywhere | "Manage all locations" | `/app/locations` |
| T5 | Click a location card on `/app/locations` | (unchanged — whatever it was) | `/app/locations/[id]` |
| T6 | Use in-content picker to switch from Dr. Huang to Oishi | (unchanged) | `/app/locations/[oishi-id]` |
| T7 | Reload after pick → cookie persists | Matches last pick | (page-driven) |
| T8 | Delete the selected location, reload | "Manage all locations" (stale defense) | (page-driven) |
