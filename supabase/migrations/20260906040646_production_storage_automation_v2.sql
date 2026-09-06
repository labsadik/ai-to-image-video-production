create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

alter table public.assets drop constraint if exists assets_status_check;
alter table public.assets add constraint assets_status_check check (status = any (array['pending'::text,'uploading'::text,'ready'::text,'review'::text,'blocked'::text,'failed'::text,'deleted'::text]));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('solamentis-assets','solamentis-assets',false,26214400,ARRAY['image/png','image/jpeg','image/webp']::text[])
on conflict (id) do update set public=false, file_size_limit=26214400, allowed_mime_types=ARRAY['image/png','image/jpeg','image/webp']::text[];

drop policy if exists "solamentis assets own select" on storage.objects;
drop policy if exists "solamentis assets own insert" on storage.objects;
drop policy if exists "solamentis assets own update" on storage.objects;
drop policy if exists "solamentis assets own delete" on storage.objects;

create policy "solamentis assets own select" on storage.objects for select to authenticated using (bucket_id='solamentis-assets' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy "solamentis assets own insert" on storage.objects for insert to authenticated with check (bucket_id='solamentis-assets' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy "solamentis assets own update" on storage.objects for update to authenticated using (bucket_id='solamentis-assets' and (storage.foldername(name))[1]=(select auth.uid()::text)) with check (bucket_id='solamentis-assets' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy "solamentis assets own delete" on storage.objects for delete to authenticated using (bucket_id='solamentis-assets' and (storage.foldername(name))[1]=(select auth.uid()::text));

create index if not exists assets_user_status_created_idx on public.assets(user_id,status,created_at desc);
create index if not exists generation_jobs_queue_status_created_idx on public.generation_jobs(status,created_at asc);
create index if not exists generation_outputs_job_variant_idx on public.generation_outputs(job_id,variant);
create unique index if not exists billing_events_provider_event_uidx on public.billing_events(provider,event_id);

create schema if not exists private;
create table if not exists private.runtime_secrets (name text primary key, secret text not null, created_at timestamptz not null default now(), rotated_at timestamptz not null default now());
revoke all on schema private from public, anon, authenticated;
revoke all on table private.runtime_secrets from public, anon, authenticated;
insert into private.runtime_secrets(name,secret) values ('solamentis_generation_worker', encode(gen_random_bytes(32),'hex')) on conflict (name) do nothing;

create or replace function public.get_generation_worker_secret() returns text language sql security definer set search_path=private as $$ select secret from private.runtime_secrets where name='solamentis_generation_worker' $$;
revoke all on function public.get_generation_worker_secret() from public, anon, authenticated;
grant execute on function public.get_generation_worker_secret() to service_role;
