update public.plans
set max_uploads_per_project = case id
  when 'free' then 1
  when 'pro' then 5
  when 'business' then 10
  else max_uploads_per_project
end,
updated_at = now()
where id in ('free', 'pro', 'business');
