alter table public.ai_providers add column if not exists protocol text not null default 'generic_json';
alter table public.ai_providers add constraint ai_providers_protocol_check check (protocol in ('google_gemini','openai_images','generic_json'));
alter table public.ai_providers add column if not exists request_config jsonb not null default '{}'::jsonb;
alter table public.ai_providers add column if not exists timeout_ms integer not null default 120000 check (timeout_ms between 5000 and 300000);
create index if not exists ai_providers_enabled_idx on public.ai_providers(enabled, protocol);
update public.ai_providers set protocol='google_gemini', base_url='https://generativelanguage.googleapis.com/v1beta' where id='google';
update public.ai_providers set protocol='openai_images', base_url='https://api.openai.com/v1', request_config='{"path":"/images/generations","method":"POST","auth":"bearer","body":{"model":"{{model}}","prompt":"{{prompt}}","n":1,"response_format":"b64_json"},"response":{"base64Path":"data.0.b64_json","mimeTypePath":"data.0.mime_type","externalIdPath":"created"}}'::jsonb where id='openai';
update public.ai_providers set protocol='generic_json' where id='anthropic';
