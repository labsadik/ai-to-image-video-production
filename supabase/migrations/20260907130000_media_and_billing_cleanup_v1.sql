begin;

alter table public.ai_feature_routes drop constraint if exists ai_feature_routes_category_check;
alter table public.ai_feature_routes drop constraint if exists ai_feature_routes_quality_check;

delete from public.ai_feature_routes where category = 'text_graphic';
update public.ai_feature_routes set category = 'image_generation' where category = 'social_image';
update public.ai_feature_routes set category = 'video_generation' where category = 'video_ad';
update public.ai_feature_routes set fallback_provider_id = null, fallback_model_id = null;

alter table public.ai_feature_routes add constraint ai_feature_routes_category_check
  check (category in ('image_generation','image_analysis','video_generation'));
alter table public.ai_feature_routes add constraint ai_feature_routes_quality_check
  check (
    (category = 'image_generation' and quality in ('basic','medium','ultra'))
    or (category = 'image_analysis' and quality in ('basic','medium','hard'))
    or (category = 'video_generation' and quality = 'standard')
  );

update public.ai_models
set supports_edit = false, updated_at = now()
where provider_id = 'google'
  and model_key in ('gemini-3.1-flash-lite-image','gemini-3.1-flash-image','gemini-3-pro-image');

update public.ai_models
set supports_generate = true,
    metadata = jsonb_set(coalesce(metadata,'{}'::jsonb), '{duration_seconds}', '[5,10]'::jsonb, true),
    updated_at = now()
where provider_id = 'fal'
  and model_key = 'fal-ai/kling-video/v2.6/pro/text-to-video';

update public.credit_products
set active = false, metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('expires', true, 'retired', true), updated_at = now()
where id = 'addon_50_usd';

update public.credit_products
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('expires', true), updated_at = now()
where id in ('credit_50','credit_125','credit_300','credit_700','credit_1299');

revoke execute on function public.grant_addon_credits(uuid,bigint,text,text,jsonb) from anon, authenticated;
drop function if exists public.grant_addon_credits(uuid,bigint,text,text,jsonb);

commit;
