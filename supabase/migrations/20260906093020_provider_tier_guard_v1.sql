update public.ai_models
set metadata = jsonb_build_object('tier', 'preview', 'tiers', jsonb_build_array('preview'))
where provider_id = 'huggingface'
  and model_key = 'black-forest-labs/FLUX.1-schnell';
