alter table public.ai_providers drop constraint if exists ai_providers_protocol_check;
alter table public.ai_providers add constraint ai_providers_protocol_check check (protocol = any (array['google_gemini','openai_images','generic_json','huggingface_image']::text[]));

insert into public.ai_providers (id, display_name, enabled, protocol, base_url, secret_env, timeout_ms, request_config)
values ('huggingface','Hugging Face',true,'huggingface_image','https://router.huggingface.co','HF_TOKEN',120000,'{"provider":"auto"}'::jsonb)
on conflict (id) do update set display_name=excluded.display_name, enabled=true, protocol=excluded.protocol, base_url=excluded.base_url, secret_env=excluded.secret_env, timeout_ms=excluded.timeout_ms, request_config=excluded.request_config;

insert into public.ai_models (provider_id, model_key, display_name, enabled, supports_generate, supports_edit, supports_reference_images)
select 'huggingface','black-forest-labs/FLUX.1-schnell','FLUX.1 schnell',true,true,false,false
where not exists (select 1 from public.ai_models where provider_id='huggingface' and model_key='black-forest-labs/FLUX.1-schnell');

update public.ai_plan_routes r
set provider_id='huggingface', model_id=m.id, fallback_provider_id='google', fallback_model_id=g.id
from public.ai_models m, public.ai_models g
where m.provider_id='huggingface' and m.model_key='black-forest-labs/FLUX.1-schnell'
  and g.provider_id='google' and g.model_key='gemini-3.1-flash-lite-image'
  and r.plan_id='free' and r.quality='preview';
