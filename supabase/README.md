# Supabase migrations

This folder is the source of truth for the BAAM Review database schema. The numbered files in `migrations/` map 1:1 to changes in §8 of `docs/BAAM_REVIEW_MASTER_PLAN.md`.

## Migration order

| File | Purpose |
|---|---|
| `migrations/0001_init.sql` | All 7 tables, foreign keys, check constraints, indexes, `updated_at` triggers |
| `migrations/0002_rls.sql` | `current_account_id()` helper + RLS policies on every admin table |
| `migrations/0003_auth_trigger.sql` | `handle_new_user` trigger + backfill of pre-existing `auth.users` |
| `seed.sql` | Optional: one demo location for the first existing account |

## Applying migrations (no CLI required)

The frictionless path is the Supabase dashboard SQL editor.

1. Open your project at [supabase.com/dashboard](https://supabase.com/dashboard) → **SQL Editor → + New query**
2. Paste the contents of `migrations/0001_init.sql`. Click **Run**.
3. Repeat for `migrations/0002_rls.sql`, then `migrations/0003_auth_trigger.sql`.
4. (Optional) Paste `seed.sql` to get a demo location.

After 0003 runs, your existing test user from Session 1 will have `accounts` and `users` rows backfilled. Confirm with:

```sql
SELECT au.email, pu.full_name, pa.name AS account_name, pa.subscription_tier
FROM auth.users au
JOIN public.users pu ON pu.id = au.id
JOIN public.accounts pa ON pa.id = pu.account_id;
```

You should see one row per signed-up user.

## Applying migrations (with the Supabase CLI)

If you prefer CLI-driven workflows:

```bash
brew install supabase/tap/supabase   # one time
supabase login                        # one time
supabase link --project-ref <your-project-ref>
supabase db push
```

The `supabase/migrations/` folder structure is already what `supabase db push` expects.

## Adding a new migration later

```
supabase/migrations/
  0004_<description>.sql
```

Numbering is monotonic; never edit a migration after it has been applied to any environment.
