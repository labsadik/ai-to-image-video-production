alter table public.safety_policies add column if not exists moderation_provider_id text references public.ai_providers(id) on delete restrict;
alter table public.safety_policies add column if not exists moderation_model_id uuid references public.ai_models(id) on delete restrict;
create index if not exists safety_policies_moderation_provider_idx on public.safety_policies(moderation_provider_id);
create index if not exists safety_policies_moderation_model_idx on public.safety_policies(moderation_model_id);

alter table public.safety_events add column if not exists provider_id text;
alter table public.safety_events add column if not exists model_key text;
create index if not exists safety_events_provider_created_idx on public.safety_events(provider_id, created_at desc);

insert into public.ai_models (provider_id, model_key, display_name, enabled, supports_generate, supports_edit, supports_reference_images, max_input_images, supported_sizes, metadata)
select 'google', 'gemini-3.1-flash-lite', 'Gemini 3.1 Flash Lite — Safety Vision', true, false, false, true, 1, ARRAY['TEXT']::text[], jsonb_build_object('purpose','image_moderation','structured_outputs',true)
where not exists (select 1 from public.ai_models where provider_id='google' and model_key='gemini-3.1-flash-lite');

update public.safety_policies
set moderation_provider_id='google',
    moderation_model_id=(select id from public.ai_models where provider_id='google' and model_key='gemini-3.1-flash-lite' limit 1)
where status='active';
