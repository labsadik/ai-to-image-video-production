-- Allow the private application asset bucket to store generated MP4 videos
-- alongside the existing compressed image formats.
-- Applied to Supabase project yyeidanzflitrstvooxw as migration
-- 20260907142645_production_video_storage_and_api_compat_v1.

BEGIN;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','video/mp4']::text[]
WHERE id = 'solamentis-assets';

COMMIT;
