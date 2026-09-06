create unique index if not exists generation_outputs_job_variant_uidx
  on public.generation_outputs (job_id, variant);

create temporary table tmp_generation_exports on commit drop as
select
  go.job_id,
  go.asset_id,
  go.storage_path,
  go.mime_type,
  go.width,
  go.height,
  go.byte_size,
  coalesce(legacy.paths, '[]'::jsonb) as legacy_paths
from public.generation_outputs go
join public.generation_jobs gj on gj.id = go.job_id and gj.status = 'succeeded'
left join (
  select job_id, jsonb_agg(storage_path order by variant) as paths
  from public.generation_outputs
  where variant in ('preview', 'editor')
  group by job_id
) legacy on legacy.job_id = go.job_id
where go.variant = 'export';

update public.assets a
set metadata = coalesce(a.metadata, '{}'::jsonb)
  || jsonb_build_object(
    'storage_variant', 'master',
    'legacy_storage_paths', t.legacy_paths
  )
from tmp_generation_exports t
where a.id = t.asset_id;

insert into public.generation_outputs (
  job_id, asset_id, variant, storage_path, mime_type, width, height, byte_size
)
select
  t.job_id,
  t.asset_id,
  'master',
  t.storage_path,
  t.mime_type,
  t.width,
  t.height,
  t.byte_size
from tmp_generation_exports t
on conflict (job_id, variant) do nothing;

delete from public.generation_outputs
where variant in ('preview', 'editor');

update public.generation_jobs gj
set output_path = t.storage_path
from tmp_generation_exports t
where gj.id = t.job_id;
