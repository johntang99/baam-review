-- Inputs driving the Analytics & Review Revenue tab. Stored on locations
-- so each location can have its own ticket/LTV/conversion knobs. Reuses the
-- existing avg_customer_value_cents as the "average ticket" input.

ALTER TABLE locations
  ADD COLUMN ltv_per_customer_cents integer,
  ADD COLUMN referral_close_rate numeric(4,3) NOT NULL DEFAULT 0.5,
  ADD COLUMN review_attribution_share numeric(4,3) NOT NULL DEFAULT 0.5;

COMMENT ON COLUMN locations.ltv_per_customer_cents IS
  '12-month lifetime value per customer. Used for the "Lifetime value of customers gained" number on the Analytics > Estimated Revenue tab.';
COMMENT ON COLUMN locations.referral_close_rate IS
  'Fraction of friends who click Book that actually convert. 0-1 range. Default 0.5.';
COMMENT ON COLUMN locations.review_attribution_share IS
  'Fraction of GBP profile-view lift we credit to new reviews vs baseline traffic. 0-1 range. Default 0.5.';
