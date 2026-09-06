alter table public.assets drop constraint if exists assets_kind_check;
alter table public.assets add constraint assets_kind_check check (kind = any (array['upload'::text,'reference'::text,'generated'::text,'preview'::text,'editor'::text,'export'::text]));

select cron.unschedule(jobid) from cron.job where jobname='solamentis-generation-worker';
select cron.schedule('solamentis-generation-worker','*/1 * * * *',$cron$
  select net.http_post(
    url := 'https://yyeidanzflitrstvooxw.supabase.co/functions/v1/generation-worker',
    headers := jsonb_build_object('Content-Type','application/json','x-solamentis-secret',(select public.get_generation_worker_secret())),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
$cron$);
