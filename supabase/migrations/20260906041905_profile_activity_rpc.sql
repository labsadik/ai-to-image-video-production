create or replace function public.record_profile_login(p_user_id uuid)
returns public.profiles
language plpgsql security definer set search_path=public
as $$
declare v public.profiles;
begin
  update public.profiles set last_login_at=now(), last_seen_at=now(), login_count=login_count+1, updated_at=now() where id=p_user_id returning * into v;
  if v.id is null then raise exception 'profile not found'; end if;
  return v;
end;
$$;
revoke all on function public.record_profile_login(uuid) from public, anon, authenticated;
