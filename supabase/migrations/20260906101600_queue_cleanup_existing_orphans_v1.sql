do $$
declare
  v_msg_id bigint;
begin
  foreach v_msg_id in array array[33::bigint,34::bigint,35::bigint] loop
    perform pgmq.delete('solamentis_generation', v_msg_id);
  end loop;
end;
$$;
