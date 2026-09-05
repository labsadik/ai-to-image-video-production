create policy "internal only" on public.rate_limit_buckets for all to public using (false) with check (false);
create policy "internal only" on public.provider_health_events for all to public using (false) with check (false);
create policy "internal only" on public.job_failures for all to public using (false) with check (false);
