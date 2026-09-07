revoke update on public.profiles from anon, authenticated;
drop policy if exists "profiles own update" on public.profiles;
drop policy if exists "profiles own insert" on public.profiles;
drop policy if exists "jobs own inserts" on public.generation_jobs;

create index if not exists billing_transactions_product_id_idx
  on public.billing_transactions(product_id);

create index if not exists billing_transactions_subscription_idx
  on public.billing_transactions(stripe_subscription_id, purchased_at desc);
