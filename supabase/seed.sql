-- supabase/seed.sql
-- OPTIONAL: a single demo location for the first existing user, so the rest of
-- the admin UI has something to render before Session 4 builds locations CRUD.
--
-- Safe to run multiple times — uses ON CONFLICT DO NOTHING.
--
-- Apply via the Supabase SQL editor AFTER 0001-0003.

DO $$
DECLARE
  first_account_id uuid;
BEGIN
  SELECT id INTO first_account_id FROM public.accounts ORDER BY created_at LIMIT 1;

  IF first_account_id IS NULL THEN
    RAISE NOTICE 'No accounts yet — skip seed. Sign up a user first.';
    RETURN;
  END IF;

  INSERT INTO public.locations (
    account_id, slug, display_name, business_type,
    default_language, supported_languages, welcome_message
  )
  VALUES (
    first_account_id,
    'demo',
    'Demo Clinic',
    'clinic',
    'en',
    ARRAY['en','zh','es']::text[],
    '{"en":"Thanks for visiting Demo Clinic.","zh":"感谢您光临 Demo 诊所。","es":"Gracias por visitar Demo Clinic."}'::jsonb
  )
  ON CONFLICT (slug) DO NOTHING;
END $$;
