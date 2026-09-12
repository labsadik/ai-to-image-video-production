create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro','business')),
  credits bigint not null default 0 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','succeeded','failed','cancelled')),
  operation text not null,
  prompt text not null,
  size text not null,
  quality text not null check (quality in ('preview','standard','premium')),
  provider text not null,
  model text not null,
  reserved_credits bigint not null default 0 check (reserved_credits >= 0),
  idempotency_key text not null,
  external_job_id text,
  output_path text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique(user_id, idempotency_key)
);

create index if not exists generation_jobs_user_created_idx on public.generation_jobs(user_id, created_at desc);
create index if not exists generation_jobs_status_created_idx on public.generation_jobs(status, created_at);

alter table public.profiles enable row level security;
alter table public.generation_jobs enable row level security;

create policy "profiles own row" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "jobs own rows" on public.generation_jobs for select to authenticated using ((select auth.uid()) = user_id);
create policy "jobs own inserts" on public.generation_jobs for insert to authenticated with check ((select auth.uid()) = user_id);
