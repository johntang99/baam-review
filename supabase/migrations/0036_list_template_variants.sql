-- AI variations for bulk review-request sends (Option B from product plan).
-- Staff generates 5 subject+body variants on the list before sending; each
-- customer in the list is randomly assigned one at send time. This breaks
-- spam-filter template fingerprinting while keeping operator control.

-- lists.template_variants stores an array of {subject, body, tone} objects.
-- Null until the staff explicitly clicks "Generate variations" on the
-- presend page. When null, sendList falls back to the default template
-- (existing v1 behavior — fully backwards compatible).
alter table public.lists
  add column template_variants jsonb;

comment on column public.lists.template_variants is
  'Array of {subject, body, tone} variant objects. Null = use default template (legacy behavior). When set, sendList picks a random entry per customer and saves the chosen index on list_customers.variant_index + review_requests.variant_index.';

-- Track which variant each individual send used. Lets us compute per-variant
-- open/click/review rates downstream by joining review_requests through
-- list_customers.send_request_id.
alter table public.list_customers
  add column variant_index integer;

alter table public.review_requests
  add column variant_index integer;

comment on column public.list_customers.variant_index is
  'Index into the parent list.template_variants array (0-based) that was used for this customer at send time. Null when the list had no variants configured.';

comment on column public.review_requests.variant_index is
  'Index into lists.template_variants — mirror of list_customers.variant_index for analytics queries that go through review_requests (opens/clicks). Null for non-list sends.';
