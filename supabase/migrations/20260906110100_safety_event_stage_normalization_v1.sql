-- Keep safety event storage backward-compatible with older app workers
-- while preserving the canonical database CHECK constraint.

create or replace function public.normalize_safety_event_stage()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.stage := case new.stage
    when 'prompt_validation' then 'prompt'
    when 'post_generation_image_moderation' then 'generation'
    else new.stage
  end;
  return new;
end;
$$;

drop trigger if exists safety_events_stage_normalize on public.safety_events;
create trigger safety_events_stage_normalize
before insert or update of stage on public.safety_events
for each row execute function public.normalize_safety_event_stage();
