-- 0004_google_tokens.sql
-- Stores GBP OAuth tokens, one row per account.
-- v1 assumes one Google identity per BAAM Review account; revisit if we
-- ever need to attach two GBP accounts to one BAAM account.

CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
  account_id uuid PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expiry timestamptz NOT NULL,
  scope text NOT NULL,
  google_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_expiry
  ON public.google_oauth_tokens(expiry);

DROP TRIGGER IF EXISTS google_oauth_tokens_touch_updated_at ON public.google_oauth_tokens;
CREATE TRIGGER google_oauth_tokens_touch_updated_at
  BEFORE UPDATE ON public.google_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: enabled but no policies for `authenticated` role. Tokens are
-- read/written exclusively by the service-role client in trusted server code.
ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;
