alter table public.ai_providers drop constraint if exists ai_providers_protocol_check;
alter table public.ai_providers add constraint ai_providers_protocol_check check (protocol = any (array['google_gemini','openai_images','generic_json','huggingface_image','huggingface_vlm']::text[]));

insert into public.ai_providers (id, display_name, enabled, protocol, base_url, secret_env, timeout_ms, request_config)
values ('huggingface-moderation','Hugging Face Moderation',true,'huggingface_vlm','https://router.huggingface.co','HF_TOKEN',60000,'{"provider":"auto"}'::jsonb)
on conflict (id) do update set display_name=excluded.display_name, enabled=true, protocol=excluded.protocol, base_url=excluded.base_url, secret_env=excluded.secret_env, timeout_ms=excluded.timeout_ms, request_config=excluded.request_config;

insert into public.ai_models (provider_id, model_key, display_name, enabled, supports_generate, supports_edit, supports_reference_images)
select 'huggingface-moderation','Qwen/Qwen2.5-VL-3B-Instruct','Qwen 2.5 VL 3B Instruct',true,false,false,true
where not exists (select 1 from public.ai_models where provider_id='huggingface-moderation' and model_key='Qwen/Qwen2.5-VL-3B-Instruct');

update public.safety_policies p
set moderation_provider_id='huggingface-moderation', moderation_model_id=m.id
from public.ai_models m
where p.status='active' and m.provider_id='huggingface-moderation' and m.model_key='Qwen/Qwen2.5-VL-3B-Instruct';
