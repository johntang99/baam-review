-- 0028_booking_requests_extend.sql
-- Extend booking_requests with fields the consultation form needs:
--   phone     — optional contact number
--   website   — business website URL
--   address   — business address (lets us pull Google Business Profile pre-call)
--   language  — 'en' or 'zh' so the auto-confirm email is in the right language
--
-- The existing 'business' free-text column stays nullable for back-compat
-- with rows from the old /book form, but the new bilingual form doesn't
-- collect it (address + website cover the same information more specifically).
--
-- preferred_time stays a text column. The new form constrains values to
-- "morning" / "afternoon" but historically may contain arbitrary strings
-- like "weekday afternoons EST", so we don't add a CHECK.

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
