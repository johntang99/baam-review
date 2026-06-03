-- Onboarding progress bar — Step 3 ("Start Review Request").
--
-- Set once when the user clicks the Step 3 CTA on the dashboard onboarding
-- bar. NULL = not yet activated. The dashboard reads this to decide
-- whether the onboarding bar should still show; once set, the bar hides
-- permanently for that account.
--
-- Per-account (not per-user) because every user in an account shares the
-- same onboarding completeness — if the owner activated it, teammates
-- shouldn't be re-prompted.

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS onboarding_request_activated_at TIMESTAMPTZ NULL;
