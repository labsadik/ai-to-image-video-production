drop policy if exists "credit grants internal only" on public.credit_grants;
create policy "credit grants internal only"
on public.credit_grants
for all to public
using (false)
with check (false);

 drop policy if exists "credit reservations internal only" on public.credit_reservations;
create policy "credit reservations internal only"
on public.credit_reservations
for all to public
using (false)
with check (false);

revoke all on table public.credit_grants from public, anon, authenticated;
revoke all on table public.credit_reservations from public, anon, authenticated;
grant select, insert, update, delete on table public.credit_grants to service_role;
grant select, insert, update, delete on table public.credit_reservations to service_role;
