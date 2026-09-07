-- Production integrity domain guards for the live Solamentis schema.
-- Applied to Supabase project yyeidanzflitrstvooxw as migration
-- 20260907142001_production_integrity_domain_guards_v1.

BEGIN;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_name_check
  CHECK (length(btrim(name)) BETWEEN 1 AND 200);

ALTER TABLE public.assets
  ADD CONSTRAINT assets_storage_path_check
  CHECK (length(btrim(storage_path)) > 0 AND length(btrim(storage_path)) <= 1024);

ALTER TABLE public.billing_transactions
  ADD CONSTRAINT billing_transactions_amount_minor_check
  CHECK (amount_minor >= 0);

ALTER TABLE public.billing_transactions
  ADD CONSTRAINT billing_transactions_currency_check
  CHECK (currency = upper(currency) AND length(currency) = 3);

ALTER TABLE public.credit_products
  ADD CONSTRAINT credit_products_currency_check
  CHECK (currency = upper(currency) AND length(currency) = 3);

ALTER TABLE public.credit_product_prices
  ADD CONSTRAINT credit_product_prices_country_check
  CHECK (country_code = upper(country_code) AND length(country_code) = 2);

ALTER TABLE public.credit_product_prices
  ADD CONSTRAINT credit_product_prices_currency_check
  CHECK (currency = upper(currency) AND length(currency) = 3);

ALTER TABLE public.plan_prices
  ADD CONSTRAINT plan_prices_country_check
  CHECK (country_code = upper(country_code) AND length(country_code) = 2);

ALTER TABLE public.plan_prices
  ADD CONSTRAINT plan_prices_currency_check
  CHECK (currency = upper(currency) AND length(currency) = 3);

ALTER TABLE public.plans
  ADD CONSTRAINT plans_max_uploads_per_month_check
  CHECK (max_uploads_per_month > 0);

ALTER TABLE public.credit_grants
  ADD CONSTRAINT credit_grants_remaining_bounds_check
  CHECK (remaining_amount >= 0 AND remaining_amount <= amount);

ALTER TABLE public.credit_reservations
  ADD CONSTRAINT credit_reservations_component_total_check
  CHECK (monthly_amount + addon_amount = amount);

CREATE OR REPLACE FUNCTION public.handle_subscription_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if new.status='cancelled' and old.status is distinct from new.status then
    perform public.notify_user(
      new.user_id,
      'plan_expired',
      'Plan ended',
      'Your paid plan has ended. Your account has been moved to the available plan state.',
      'warning',
      'plan-expired:'||new.id::text||':'||new.status,
      jsonb_build_object('subscription_id',new.id,'status',new.status,'plan_id',new.plan_id)
    );
  end if;
  return new;
end;
$function$;

COMMIT;
