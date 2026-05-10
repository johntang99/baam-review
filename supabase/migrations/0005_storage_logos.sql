-- 0005_storage_logos.sql
-- Storage bucket for per-location logos, with strict folder-by-account policies.

-- =============================================================================
-- Bucket: logos. Public read so the logo can be served via the public review
-- page; writes restricted by RLS below.
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2 * 1024 * 1024,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================================================
-- RLS on storage.objects for the logos bucket.
-- Convention: every object lives at <account_id>/<filename>.
-- =============================================================================

-- Anyone can read (bucket is public, but make it explicit).
DROP POLICY IF EXISTS "logos_public_read" ON storage.objects;
CREATE POLICY "logos_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'logos');

-- Only the account owner can write to their own folder.
DROP POLICY IF EXISTS "logos_account_owner_insert" ON storage.objects;
CREATE POLICY "logos_account_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = (public.current_account_id())::text
  );

DROP POLICY IF EXISTS "logos_account_owner_update" ON storage.objects;
CREATE POLICY "logos_account_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = (public.current_account_id())::text
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = (public.current_account_id())::text
  );

DROP POLICY IF EXISTS "logos_account_owner_delete" ON storage.objects;
CREATE POLICY "logos_account_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = (public.current_account_id())::text
  );
