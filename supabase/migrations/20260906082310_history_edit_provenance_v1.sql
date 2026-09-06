insert into public.ai_models (id,provider_id,model_key,display_name,enabled,supports_generate,supports_edit,supports_reference_images,max_input_images,metadata) select gen_random_uuid(),'huggingface','Qwen/Qwen-Image-Edit','Qwen Image Edit',true,false,true,true,1,jsonb_build_object('purpose','image_editing') where not exists (select 1 from public.ai_models where provider_id='huggingface' and model_key='Qwen/Qwen-Image-Edit');
create index if not exists generation_jobs_user_created_idx on public.generation_jobs(user_id,created_at desc);
create index if not exists generation_jobs_user_project_created_idx on public.generation_jobs(user_id,project_id,created_at desc);
create index if not exists assets_job_metadata_idx on public.assets(user_id,(metadata->>'job_id'));
