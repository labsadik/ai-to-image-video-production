delete from public.generation_outputs
where variant = 'export'
  and exists (
    select 1
    from public.generation_outputs master
    where master.job_id = generation_outputs.job_id
      and master.variant = 'master'
  );

update public.assets a
set metadata = coalesce(a.metadata, '{}'::jsonb)
  || jsonb_build_object('storage_variant', 'master');
