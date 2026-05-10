-- 0003_auth_trigger.sql
-- When a Supabase auth user signs up, automatically create their account + users rows.
-- Also backfills existing auth.users that pre-date this trigger.

-- =============================================================================
-- handle_new_user: fires on auth.users INSERT.
-- Creates a personal account for the new user and links a public.users row.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  resolved_full_name text;
  new_account_id uuid;
BEGIN
  resolved_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.accounts (name, primary_email)
  VALUES (resolved_full_name, NEW.email)
  RETURNING id INTO new_account_id;

  INSERT INTO public.users (id, account_id, full_name, role)
  VALUES (NEW.id, new_account_id, resolved_full_name, 'owner');

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Backfill: any existing auth.users without a public.users row.
-- Uses a single CTE to keep account/user creation in one transaction.
-- =============================================================================
WITH missing_users AS (
  SELECT
    au.id,
    au.email,
    COALESCE(
      NULLIF(au.raw_user_meta_data->>'full_name', ''),
      split_part(au.email, '@', 1)
    ) AS full_name
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.id = au.id
  WHERE pu.id IS NULL
),
inserted_accounts AS (
  INSERT INTO public.accounts (name, primary_email)
  SELECT full_name, email FROM missing_users
  RETURNING id, primary_email
)
INSERT INTO public.users (id, account_id, full_name, role)
SELECT
  mu.id,
  ia.id,
  mu.full_name,
  'owner'
FROM missing_users mu
JOIN inserted_accounts ia ON ia.primary_email = mu.email;
