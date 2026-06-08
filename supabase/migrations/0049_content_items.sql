-- Generic content storage for the marketing / SEO admin. One table
-- handles four content kinds so we don't sprawl into a separate
-- blog_posts, case_studies, city_pages, marketing_pages set of tables
-- — the schemas are very close, and the differences live in the
-- frontmatter JSON.
--
-- BAAM internal staff are the only readers + writers. Public consumers
-- (the renderer at /blog/<slug>, /local/<slug>, /case-studies, etc.)
-- query via the service-role client, so the table is RLS-locked to
-- staff for the regular client + open for service-role.

create table if not exists public.content_items (
  id           uuid primary key default gen_random_uuid(),

  -- Which surface this item belongs to. Drives which list view it
  -- shows in inside /admin and which renderer queries for it.
  --   - 'blog_post'      -> /blog/<slug>
  --   - 'case_study'     -> card on /case-studies
  --   - 'city_page'      -> editorial copy for /local/<slug>
  --   - 'marketing_page' -> editable sections of /about, /contact, /pricing, etc.
  kind text not null check (
    kind in ('blog_post', 'case_study', 'city_page', 'marketing_page')
  ),

  -- URL slug or registry key. Unique per (kind, locale) — see index below.
  -- For city_page this matches lib/seo/cities.ts; for marketing_page
  -- it's the path slug (e.g. 'about').
  slug text not null,

  -- Locale code. 'en' is the default; bilingual posts get a second
  -- row with locale='zh'.
  locale text not null default 'en' check (locale in ('en', 'zh')),

  -- Frontmatter — title, description, date, author, keywords, image,
  -- author_url, etc. Kept as a single JSONB so we can evolve the
  -- shape per-kind without schema migrations.
  frontmatter jsonb not null default '{}'::jsonb,

  -- Markdown body. Empty for kinds that don't need long-form content
  -- (e.g. city_page might use frontmatter alone).
  body text not null default '',

  -- Publication state. 'draft' is hidden from public renderers;
  -- 'published' is live.
  status text not null default 'draft'
    check (status in ('draft', 'published')),

  -- Audit fields.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,

  -- Optional publish-at timestamp (when published, this is set; when
  -- demoted back to draft, kept as last-published marker).
  published_at timestamptz
);

-- One slug per (kind, locale). Lets a blog post have an EN and a ZH
-- variant under the same slug, or city_page='flushing' have separate
-- EN / ZH editorial copy.
create unique index if not exists content_items_kind_slug_locale_uniq
  on public.content_items (kind, slug, locale);

-- Fast list-by-kind queries.
create index if not exists content_items_kind_status_idx
  on public.content_items (kind, status, published_at desc nulls last);

-- updated_at auto-touch on UPDATE.
create or replace function public.touch_content_items_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_content_items_updated_at on public.content_items;
create trigger trg_content_items_updated_at
  before update on public.content_items
  for each row execute function public.touch_content_items_updated_at();

-- ============================================================
-- RLS — BAAM internal staff only. Anonymous + customer accounts have
-- zero visibility; renderers query via service-role.
-- ============================================================
alter table public.content_items enable row level security;

drop policy if exists "content_items_select_internal" on public.content_items;
create policy "content_items_select_internal"
  on public.content_items
  for select
  using (
    exists (
      select 1
      from public.users u
      join public.accounts a on a.id = u.account_id
      where u.id = auth.uid() and a.is_baam_internal = true
    )
  );

drop policy if exists "content_items_insert_internal" on public.content_items;
create policy "content_items_insert_internal"
  on public.content_items
  for insert
  with check (
    exists (
      select 1
      from public.users u
      join public.accounts a on a.id = u.account_id
      where u.id = auth.uid() and a.is_baam_internal = true
    )
  );

drop policy if exists "content_items_update_internal" on public.content_items;
create policy "content_items_update_internal"
  on public.content_items
  for update
  using (
    exists (
      select 1
      from public.users u
      join public.accounts a on a.id = u.account_id
      where u.id = auth.uid() and a.is_baam_internal = true
    )
  )
  with check (
    exists (
      select 1
      from public.users u
      join public.accounts a on a.id = u.account_id
      where u.id = auth.uid() and a.is_baam_internal = true
    )
  );

drop policy if exists "content_items_delete_internal" on public.content_items;
create policy "content_items_delete_internal"
  on public.content_items
  for delete
  using (
    exists (
      select 1
      from public.users u
      join public.accounts a on a.id = u.account_id
      where u.id = auth.uid() and a.is_baam_internal = true
    )
  );

comment on table public.content_items is
  'Generic content storage for marketing/SEO admin (blog posts, case studies, city pages, marketing pages). Edited via /admin, read by public renderers via service-role.';
