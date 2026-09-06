alter table public.plans add column if not exists max_uploads_per_month integer not null default 1;
update public.plans
set max_uploads_per_month = case id when 'free' then 2 when 'pro' then 5 when 'business' then 20 else max_uploads_per_month end,
    updated_at = now()
where id in ('free','pro','business');
