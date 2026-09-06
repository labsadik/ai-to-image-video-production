-- Supabase secret API keys authenticate the server client without the legacy
-- request.jwt.claim.role value. These functions are already restricted to
-- service_role EXECUTE, so authorization belongs at the function privilege
-- boundary rather than relying on a JWT claim that may be absent.

create or replace function public.reserve_generation_credits(p_user_id uuid, p_amount bigint, p_idempotency_key text)
returns boolean
language plpgsql security definer set search_path=public
as $$
declare v_available bigint; v_plan text;
begin
  if p_amount <= 0 then raise exception 'invalid credit amount'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  select credits - credits_reserved, coalesce(plan_id, plan)
    into v_available, v_plan
    from public.profiles where id=p_user_id for update;
  if v_available is null then raise exception 'profile not found'; end if;
  if v_available < p_amount then return false; end if;
  update public.profiles
    set credits_reserved=credits_reserved+p_amount, updated_at=now()
    where id=p_user_id;
  insert into public.credit_ledger(user_id,kind,amount,balance_after,idempotency_key,metadata)
    values (p_user_id,'reserve',-p_amount,v_available-p_amount,p_idempotency_key,jsonb_build_object('plan',v_plan));
  return true;
end; $$;
revoke all on function public.reserve_generation_credits(uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.reserve_generation_credits(uuid,bigint,text) to service_role;

create or replace function public.finalize_generation_credits(p_user_id uuid, p_amount bigint, p_idempotency_key text)
returns boolean
language plpgsql security definer set search_path=public
as $$
begin
  if p_amount <= 0 then raise exception 'invalid credit amount'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  update public.profiles
    set credits=credits-p_amount, credits_reserved=credits_reserved-p_amount, updated_at=now()
    where id=p_user_id and credits_reserved>=p_amount and credits>=p_amount;
  if not found then raise exception 'credit finalization failed'; end if;
  insert into public.credit_ledger(user_id,kind,amount,balance_after,idempotency_key)
    values (p_user_id,'consume',-p_amount,(select credits from public.profiles where id=p_user_id),p_idempotency_key||':consume');
  return true;
end; $$;
revoke all on function public.finalize_generation_credits(uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.finalize_generation_credits(uuid,bigint,text) to service_role;

create or replace function public.refund_generation_credits(p_user_id uuid, p_amount bigint, p_idempotency_key text)
returns boolean
language plpgsql security definer set search_path=public
as $$
begin
  if p_amount <= 0 then raise exception 'invalid credit amount'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  update public.profiles
    set credits_reserved=greatest(credits_reserved-p_amount,0), updated_at=now()
    where id=p_user_id;
  if not found then raise exception 'profile not found'; end if;
  insert into public.credit_ledger(user_id,kind,amount,balance_after,idempotency_key)
    values (p_user_id,'refund',p_amount,(select credits from public.profiles where id=p_user_id),p_idempotency_key||':refund');
  return true;
end; $$;
revoke all on function public.refund_generation_credits(uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.refund_generation_credits(uuid,bigint,text) to service_role;
