alter table public.profiles add column if not exists last_seen_at timestamptz, add column if not exists last_login_at timestamptz, add column if not exists login_count integer not null default 0;
create index if not exists profiles_last_seen_idx on public.profiles(last_seen_at desc);
create or replace function public.record_auth_login() returns trigger language plpgsql security definer set search_path=public as $$ begin return new; end; $$;
revoke all on function public.record_auth_login() from public, anon, authenticated;
