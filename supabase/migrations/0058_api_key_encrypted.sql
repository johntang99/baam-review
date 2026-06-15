-- Store a reversibly-encrypted copy of each API key so the dashboard can
-- reveal/copy it more than once (the existing key_hash is one-way and only
-- used for verification). The value is AES-256-GCM ciphertext (see
-- lib/integrations/key-crypto.ts) — never plaintext. Nullable: keys created
-- before this column simply aren't revealable (the UI offers regenerate).
alter table public.location_api_keys
  add column if not exists key_encrypted text;
