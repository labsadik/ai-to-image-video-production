alter table public.generation_jobs add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists generation_jobs_project_created_idx on public.generation_jobs(project_id, created_at desc);
