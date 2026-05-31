-- 0042_gmail_oauth_tokens.sql
-- Gmail API OAuth tokens are stored separately from GBP tokens so the
-- two flows can use independent scopes and independent Google projects.

CREATE TABLE IF NOT EXISTS public.gmail_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expiry timestamptz NOT NULL,
  scope text NOT NULL,
  google_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gmail_oauth_tokens_account_id
  ON public.gmail_oauth_tokens(account_id);

CREATE INDEX IF NOT EXISTS idx_gmail_oauth_tokens_expiry
  ON public.gmail_oauth_tokens(expiry);

DROP TRIGGER IF EXISTS gmail_oauth_tokens_touch_updated_at ON public.gmail_oauth_tokens;
CREATE TRIGGER gmail_oauth_tokens_touch_updated_at
  BEFORE UPDATE ON public.gmail_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Service-role only writes/reads for now.
ALTER TABLE public.gmail_oauth_tokens ENABLE ROW LEVEL SECURITY;
