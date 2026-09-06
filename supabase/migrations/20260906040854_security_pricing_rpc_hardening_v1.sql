revoke execute on function public.reserve_generation_credits(uuid,bigint,text) from authenticated, anon, public;
grant execute on function public.reserve_generation_credits(uuid,bigint,text) to service_role;
revoke execute on function public.finalize_generation_credits(uuid,bigint,text) from authenticated, anon, public;
grant execute on function public.finalize_generation_credits(uuid,bigint,text) to service_role;
revoke execute on function public.refund_generation_credits(uuid,bigint,text) from authenticated, anon, public;
grant execute on function public.refund_generation_credits(uuid,bigint,text) to service_role;

drop policy if exists "pricing regions readable" on public.pricing_regions;
create policy "pricing regions readable" on public.pricing_regions for select to authenticated using (active=true);

drop policy if exists "plan prices readable" on public.plan_prices;
create policy "plan prices readable" on public.plan_prices for select to authenticated using (active=true);

revoke all on table public.billing_events from public, anon, authenticated;
