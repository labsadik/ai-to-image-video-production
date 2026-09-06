update public.plans
set max_uploads_per_project = case id
  when 'free' then 2
  when 'pro' then 5
  when 'business' then 20
  else max_uploads_per_project
end,
updated_at = now()
where id in ('free','pro','business');

create or replace function public.grant_addon_credits(
  p_user_id uuid,
  p_amount bigint,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_existing public.credit_ledger;
begin
  if p_amount <= 0 then
    raise exception 'invalid addon credit amount';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'invalid idempotency key';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));

  select * into v_existing
  from public.credit_ledger
  where idempotency_key = p_idempotency_key
  limit 1
  for update;

  if v_existing.id is not null then
    return true;
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'profile not found';
  end if;

  update public.profiles
  set addon_credits = addon_credits + p_amount,
      credits = credits + p_amount,
      updated_at = now()
  where id = p_user_id;

  insert into public.credit_ledger(user_id,kind,amount,balance_after,idempotency_key,metadata)
  values (
    p_user_id,
    'addon_grant',
    p_amount,
    (select credits from public.profiles where id = p_user_id),
    p_idempotency_key,
    coalesce(p_metadata,'{}'::jsonb)
  );

  return true;
end;
$function$;

revoke all on function public.grant_addon_credits(uuid,bigint,text,jsonb) from public, anon, authenticated;
grant execute on function public.grant_addon_credits(uuid,bigint,text,jsonb) to service_role;
