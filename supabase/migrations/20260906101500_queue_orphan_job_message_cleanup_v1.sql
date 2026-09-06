create or replace function public.claim_generation_messages(p_visibility_seconds integer default 300, p_quantity integer default 5)
returns table(msg_id bigint, read_ct bigint, enqueued_at timestamptz, vt timestamptz, message jsonb)
language plpgsql
security definer
set search_path to 'public', 'pgmq'
as $function$
declare
  m record;
  v_job_id text;
begin
  for m in select * from pgmq.read('solamentis_generation', greatest(p_visibility_seconds, 30), least(greatest(p_quantity, 1), 20)) loop
    v_job_id := m.message ->> 'job_id';
    if v_job_id is not null
       and v_job_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       and exists (select 1 from public.generation_jobs where id = v_job_id::uuid)
    then
      return query select m.msg_id, m.read_ct, m.enqueued_at, m.vt, m.message;
    else
      perform pgmq.delete('solamentis_generation', m.msg_id);
    end if;
  end loop;
end;
$function$;
