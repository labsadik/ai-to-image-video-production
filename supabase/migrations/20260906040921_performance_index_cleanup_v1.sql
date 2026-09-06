drop index if exists public.billing_events_provider_event_uidx;
drop index if exists public.generation_jobs_queue_status_created_idx;

create index if not exists profiles_billing_country_code_idx on public.profiles(billing_country_code);
create index if not exists profiles_detected_country_code_idx on public.profiles(detected_country_code);
create index if not exists subscriptions_country_code_idx on public.subscriptions(country_code);
