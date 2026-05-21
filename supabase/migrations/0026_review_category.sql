-- 0026_review_category.sql
-- Add review_category to locations. This is BAAM Review's normalized
-- vertical bucket (46 values) used to pick the right service / quality
-- chip presets on the public review page (/r/[slug]).
--
-- Distinct from locations.business_type, which stores the raw Google
-- Business Profile primary-category string ("Italian restaurant",
-- "Acupuncturist", etc). business_type can be 1 of thousands of Google
-- values; review_category collapses them to ~46 buckets each with a
-- curated trilingual preset.
--
-- Defaults to 'other' for backfill. New locations are auto-classified
-- from Google's primary category at creation time in
-- createLocationFromGoogle via lib/review/google-category-mapping.ts.
-- Admins can override anytime in /app/locations/[id] settings.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS review_category text NOT NULL DEFAULT 'other'
    CHECK (review_category IN (
      -- food_beverage (4)
      'restaurant', 'cafe_bakery', 'bar_lounge', 'takeout_delivery',
      -- medical_health (9)
      'dental', 'acupuncture_tcm', 'chiropractic', 'optometry',
      'physical_therapy', 'mental_health', 'veterinary',
      'medical_general', 'medspa_aesthetic',
      -- attorney (5)
      'attorney_immigration', 'attorney_estate_family',
      'attorney_business_tax', 'attorney_personal_injury',
      'attorney_general',
      -- real_estate_insurance (3)
      'real_estate', 'insurance', 'mortgage_loan',
      -- auto (3)
      'auto_repair', 'auto_sales', 'auto_detailing',
      -- travel_resort (2)
      'hotel_lodging', 'travel_agency',
      -- health_food_products (2)
      'health_supplements', 'specialty_grocery',
      -- home_services (4)
      'home_repair', 'cleaning_service', 'landscape_pest', 'moving_storage',
      -- beauty_fitness (4)
      'hair_salon', 'nail_salon', 'spa_massage', 'gym_fitness',
      -- apparel_retail (3)
      'apparel_clothing', 'jewelry_watch', 'shoes_accessories',
      -- education_tutoring (3) — NEW BAAM Review parent
      'tutoring_test_prep', 'language_school', 'translation_immigration',
      -- professional_services (3) — NEW BAAM Review parent
      'accounting_tax', 'financial_advisor', 'professional_general',
      -- fallback (1)
      'other'
    ));

COMMENT ON COLUMN public.locations.review_category IS
  '46-value bucket driving the trilingual service/quality chip presets on /r/[slug]. Auto-classified from Google primary category at creation; admin can override.';
