alter table public.profiles
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists country_code text,
  add column if not exists country_name text,
  add column if not exists locale text,
  add column if not exists avatar_url text;

create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_country_idx on public.profiles(country_code);

create or replace function public.sync_auth_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, avatar_url, updated_at)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.phone, new.raw_user_meta_data->>'avatar_url', now())
  on conflict (id) do update set email=excluded.email, full_name=coalesce(excluded.full_name, public.profiles.full_name), phone=coalesce(excluded.phone, public.profiles.phone), avatar_url=coalesce(excluded.avatar_url, public.profiles.avatar_url), updated_at=now();
  return new;
end;
$$;
revoke all on function public.sync_auth_profile() from public, anon, authenticated;
drop trigger if exists on_auth_user_profile_sync on auth.users;
create trigger on_auth_user_profile_sync after insert or update of email, phone, raw_user_meta_data on auth.users for each row execute function public.sync_auth_profile();

create or replace function public.touch_profile_updated_at()
returns trigger language plpgsql set search_path = public as $$ begin new.updated_at=now(); return new; end; $$;
revoke all on function public.touch_profile_updated_at() from public, anon, authenticated;
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_profile_updated_at();

create or replace function public.write_profile_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(user_id, actor_type, action, resource_type, resource_id, metadata)
  values (new.id, 'user', 'profile.updated', 'profile', new.id, jsonb_build_object('country_code', new.country_code, 'locale', new.locale));
  return new;
end;
$$;
revoke all on function public.write_profile_audit() from public, anon, authenticated;
drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit after update of full_name, phone, country_code, country_name, locale, avatar_url on public.profiles for each row execute function public.write_profile_audit();

create policy "profiles own update" on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy "profiles own insert" on public.profiles for insert to authenticated with check ((select auth.uid())=id);
