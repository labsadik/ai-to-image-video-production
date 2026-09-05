alter table public.ai_providers add column if not exists health_checked_at timestamptz, add column if not exists health_latency_ms integer, add column if not exists health_message text, add column if not exists health_failures integer not null default 0, add column if not exists capabilities jsonb not null default '{}'::jsonb;
alter table public.ai_plan_routes add column if not exists fallback_provider_id text references public.ai_providers(id) on delete restrict, add column if not exists fallback_model_id uuid references public.ai_models(id) on delete restrict;
create index if not exists ai_plan_routes_fallback_provider_idx on public.ai_plan_routes(fallback_provider_id);
create index if not exists ai_plan_routes_fallback_model_idx on public.ai_plan_routes(fallback_model_id);

create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  count integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from anon, authenticated;
grant select, insert, update, delete on public.rate_limit_buckets to service_role;

create or replace function public.consume_rate_limit(p_bucket_key text, p_limit integer, p_window_seconds integer)
returns table(allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql security definer set search_path=public
as $$
declare v_started timestamptz; v_count integer;
begin
  if p_limit <= 0 or p_window_seconds <= 0 then raise exception 'invalid rate limit configuration'; end if;
  insert into public.rate_limit_buckets(bucket_key, window_started_at, count, updated_at)
  values(p_bucket_key, now(), 0, now())
  on conflict (bucket_key) do nothing;
  perform pg_advisory_xact_lock(hashtextextended(p_bucket_key, 0));
  select window_started_at, count into v_started, v_count from public.rate_limit_buckets where bucket_key=p_bucket_key for update;
  if now() - v_started >= make_interval(secs => p_window_seconds) then
    update public.rate_limit_buckets set window_started_at=now(), count=1, updated_at=now() where bucket_key=p_bucket_key;
    return query select true, greatest(p_limit-1,0), 0;
  end if;
  if v_count >= p_limit then
    return query select false, 0, greatest(p_window_seconds - extract(epoch from (now()-v_started))::integer, 1);
    return;
  end if;
  update public.rate_limit_buckets set count=v_count+1, updated_at=now() where bucket_key=p_bucket_key;
  return query select true, greatest(p_limit-v_count-1,0), 0;
end; $$;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

create table if not exists public.provider_health_events (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null references public.ai_providers(id) on delete cascade,
  ok boolean not null,
  latency_ms integer,
  message text,
  capabilities jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);
alter table public.provider_health_events enable row level security;
revoke all on public.provider_health_events from anon, authenticated;
grant select, insert on public.provider_health_events to service_role;
create index if not exists provider_health_events_provider_checked_idx on public.provider_health_events(provider_id, checked_at desc);

create table if not exists public.job_failures (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  attempt integer not null,
  error_code text,
  error_message text,
  provider_id text,
  model_key text,
  created_at timestamptz not null default now()
);
alter table public.job_failures enable row level security;
revoke all on public.job_failures from anon, authenticated;
grant select, insert on public.job_failures to service_role;
create index if not exists job_failures_job_created_idx on public.job_failures(job_id, created_at desc);
