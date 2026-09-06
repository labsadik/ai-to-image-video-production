update public.plans
set max_uploads_per_project = case id when 'free' then 2 when 'pro' then 5 when 'business' then 20 else max_uploads_per_project end,
    updated_at=now()
where id in ('free','pro','business');

create or replace function public.grant_addon_credits(
  p_user_id uuid,
  p_amount bigint,
  p_idempotency_key text,
  p_external_reference text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
begin
  if p_amount<=0 then raise exception 'invalid addon amount'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key))=0 then raise exception 'invalid idempotency key'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  if exists(select 1 from public.credit_grants where idempotency_key=p_idempotency_key) then return true; end if;
  insert into public.credit_grants(user_id,amount,source,idempotency_key,external_reference,metadata)
  values(p_user_id,p_amount,'addon_purchase',p_idempotency_key,p_external_reference,coalesce(p_metadata,'{}'::jsonb));
  update public.profiles set addon_credits=addon_credits+p_amount,credits=credits+p_amount,updated_at=now() where id=p_user_id;
  if not found then raise exception 'profile not found'; end if;
  insert into public.credit_ledger(user_id,kind,amount,balance_after,idempotency_key,metadata)
  values(p_user_id,'addon_grant',p_amount,(select credits from public.profiles where id=p_user_id),p_idempotency_key||':ledger',jsonb_build_object('source','addon_purchase','external_reference',p_external_reference));
  return true;
end;
$function$;

revoke all on function public.grant_addon_credits(uuid,bigint,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.grant_addon_credits(uuid,bigint,text,text,jsonb) to service_role;

create or replace function public.activate_paid_plan(
  p_user_id uuid,
  p_plan_id text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare v_plan_credits bigint; v_old_monthly bigint; v_delta bigint; v_existing public.credit_ledger;
begin
  if p_user_id is null or p_plan_id not in ('pro','business') then raise exception 'invalid paid plan activation'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key))=0 then raise exception 'invalid idempotency key'; end if;
  select monthly_credits into v_plan_credits from public.plans where id=p_plan_id and monthly_credits>0;
  if v_plan_credits is null then raise exception 'paid plan not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  select * into v_existing from public.credit_ledger where user_id=p_user_id and idempotency_key=p_idempotency_key limit 1 for update;
  if v_existing.id is not null then return true; end if;
  select monthly_credits into v_old_monthly from public.profiles where id=p_user_id for update;
  if v_old_monthly is null then raise exception 'profile not found'; end if;
  v_delta:=v_plan_credits-coalesce(v_old_monthly,0);
  update public.profiles set plan=p_plan_id,plan_id=p_plan_id,monthly_credits=v_plan_credits,credits=greatest(credits+v_delta,0),credit_period_start=coalesce(p_period_start::date,current_date),credit_period_end=coalesce(p_period_end::date,(current_date+interval '1 month')::date),updated_at=now() where id=p_user_id;
  insert into public.credit_ledger(user_id,kind,amount,balance_after,idempotency_key,metadata) values(p_user_id,'monthly_grant',v_delta,(select credits from public.profiles where id=p_user_id),p_idempotency_key,jsonb_build_object('plan',p_plan_id,'period_start',p_period_start,'period_end',p_period_end) || coalesce(p_metadata,'{}'::jsonb));
  return true;
end;
$function$;

revoke all on function public.activate_paid_plan(uuid,text,timestamptz,timestamptz,text,jsonb) from public, anon, authenticated;
grant execute on function public.activate_paid_plan(uuid,text,timestamptz,timestamptz,text,jsonb) to service_role;
