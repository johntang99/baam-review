-- Rate limiting for the intake endpoint (Phase 2 hardening).
--
-- Per-key fixed-window counters live on the key row; api_key_consume() does
-- the lookup + window reset + increment + limit check atomically under a row
-- lock (FOR UPDATE), so it is race-safe across serverless instances (no shared
-- in-memory store needed). Per-minute burst is passed by the caller (code
-- constant); the daily cap is per-location-configurable via daily_limit.

alter table public.location_api_keys
  add column if not exists daily_limit integer not null default 5000,
  add column if not exists rate_minute_window timestamptz,
  add column if not exists rate_minute_count integer not null default 0,
  add column if not exists rate_day_window date,
  add column if not exists rate_day_count integer not null default 0;

-- Verify a key by hash AND consume one rate token. Returns the bound location
-- and whether the request is allowed. No row => unknown/revoked key.
create or replace function public.api_key_consume(
  p_key_hash text,
  p_minute_limit integer
)
returns table (location_id uuid, allowed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  k public.location_api_keys%rowtype;
  now_ts timestamptz := now();
  cur_min timestamptz := date_trunc('minute', now());
  cur_day date := (now() at time zone 'UTC')::date;
  min_count integer;
  day_count integer;
begin
  select * into k
    from public.location_api_keys
    where key_hash = p_key_hash and revoked_at is null
    for update;
  if not found then
    return;  -- empty result => invalid/revoked key
  end if;

  min_count := case when k.rate_minute_window is distinct from cur_min
                    then 1 else k.rate_minute_count + 1 end;
  day_count := case when k.rate_day_window is distinct from cur_day
                    then 1 else k.rate_day_count + 1 end;

  update public.location_api_keys
    set rate_minute_window = cur_min,
        rate_minute_count = min_count,
        rate_day_window = cur_day,
        rate_day_count = day_count,
        last_used_at = now_ts
    where id = k.id;

  location_id := k.location_id;
  allowed := (min_count <= p_minute_limit
              and day_count <= coalesce(k.daily_limit, 5000));
  return next;
end;
$$;

revoke all on function public.api_key_consume(text, integer) from public, anon, authenticated;
