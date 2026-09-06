drop policy if exists "billing events internal only" on public.billing_events;
create policy "billing events internal only" on public.billing_events for all to public using (false) with check (false);
