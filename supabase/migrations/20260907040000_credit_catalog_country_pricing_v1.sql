create table if not exists public.credit_product_prices (
  product_id text not null references public.credit_products(id) on delete cascade,
  country_code text not null references public.pricing_regions(country_code) on delete restrict,
  currency text not null,
  unit_amount_minor bigint not null check (unit_amount_minor > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, country_code)
);

alter table public.credit_products add column if not exists sort_order integer not null default 0;

alter table public.credit_product_prices enable row level security;
drop policy if exists "credit product prices readable" on public.credit_product_prices;
create policy "credit product prices readable" on public.credit_product_prices
  for select to authenticated using (active = true);

insert into public.credit_products (id, display_name, credits, unit_amount_minor, currency, active, metadata, sort_order)
values
  ('credit_50', '50 Credits', 50, 969, 'USD', true, jsonb_build_object('expires', false, 'catalog', 'country_priced_v1'), 10),
  ('credit_125', '125 Credits', 125, 1988, 'USD', true, jsonb_build_object('expires', false, 'catalog', 'country_priced_v1'), 20),
  ('credit_300', '300 Credits', 300, 3988, 'USD', true, jsonb_build_object('expires', false, 'catalog', 'country_priced_v1'), 30),
  ('credit_700', '700 Credits', 700, 7988, 'USD', true, jsonb_build_object('expires', false, 'catalog', 'country_priced_v1'), 40),
  ('credit_1299', '1,299 Credits', 1299, 19988, 'USD', true, jsonb_build_object('expires', false, 'catalog', 'country_priced_v1', 'max_credits', 1299, 'max_amount_usd', 199.88), 50)
on conflict (id) do update set
  display_name=excluded.display_name,
  credits=excluded.credits,
  unit_amount_minor=excluded.unit_amount_minor,
  currency=excluded.currency,
  active=excluded.active,
  metadata=excluded.metadata,
  sort_order=excluded.sort_order,
  updated_at=now();

update public.credit_products
set active=false, updated_at=now()
where id='addon_50_usd';

insert into public.credit_product_prices (product_id, country_code, currency, unit_amount_minor, active)
select
  p.id,
  r.country_code,
  r.currency,
  round(p.unit_amount_minor * coalesce(
    nullif(pp.unit_amount_minor, 0)::numeric / nullif(us.unit_amount_minor, 0),
    1
  ))::bigint,
  true
from public.credit_products p
cross join public.pricing_regions r
left join public.plan_prices pp
  on pp.plan_id='pro' and pp.country_code=r.country_code and pp.interval='month' and pp.active=true
left join public.plan_prices us
  on us.plan_id='pro' and us.country_code='US' and us.interval='month' and us.active=true
where p.id in ('credit_50','credit_125','credit_300','credit_700','credit_1299')
  and p.active=true
on conflict (product_id, country_code) do update set
  currency=excluded.currency,
  unit_amount_minor=excluded.unit_amount_minor,
  active=excluded.active,
  updated_at=now();

create index if not exists credit_product_prices_country_idx
  on public.credit_product_prices(country_code, active, product_id);

create or replace function public.grant_credit_product_purchase(
  p_user_id uuid,
  p_product_id text,
  p_country_code text,
  p_currency text,
  p_amount_minor bigint,
  p_idempotency_key text,
  p_external_reference text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.credit_products;
  v_price public.credit_product_prices;
begin
  if p_user_id is null or p_product_id is null or p_country_code is null or p_currency is null then
    raise exception 'invalid credit purchase';
  end if;
  if p_amount_minor <= 0 then raise exception 'invalid purchase amount'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'invalid idempotency key'; end if;

  if exists (select 1 from public.credit_grants where idempotency_key=p_idempotency_key) then
    return true;
  end if;

  select * into v_product
  from public.credit_products
  where id=p_product_id and active=true;
  if v_product.id is null then raise exception 'credit product not found'; end if;

  select * into v_price
  from public.credit_product_prices
  where product_id=p_product_id
    and country_code=upper(p_country_code)
    and currency=upper(p_currency)
    and unit_amount_minor=p_amount_minor
    and active=true;
  if v_price.product_id is null then raise exception 'credit product price is not valid for this country'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  insert into public.credit_grants(user_id,amount,source,idempotency_key,external_reference,metadata)
  values(
    p_user_id,
    v_product.credits,
    'credit_product_purchase',
    p_idempotency_key,
    p_external_reference,
    jsonb_build_object(
      'product_id',v_product.id,
      'country_code',upper(p_country_code),
      'currency',upper(p_currency),
      'amount_minor',p_amount_minor
    ) || coalesce(p_metadata,'{}'::jsonb)
  );

  update public.profiles
  set addon_credits=addon_credits+v_product.credits,
      credits=credits+v_product.credits,
      updated_at=now()
  where id=p_user_id;
  if not found then raise exception 'profile not found'; end if;

  insert into public.credit_ledger(user_id,kind,amount,balance_after,idempotency_key,metadata)
  values(
    p_user_id,
    'addon_grant',
    v_product.credits,
    (select credits from public.profiles where id=p_user_id),
    p_idempotency_key||':ledger',
    jsonb_build_object('source','credit_product_purchase','product_id',v_product.id,'country_code',upper(p_country_code),'currency',upper(p_currency),'amount_minor',p_amount_minor)
  );
  return true;
end;
$$;

revoke execute on function public.grant_credit_product_purchase(uuid,text,text,text,bigint,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.grant_credit_product_purchase(uuid,text,text,text,bigint,text,text,jsonb) to service_role;
