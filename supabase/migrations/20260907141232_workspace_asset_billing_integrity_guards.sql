-- Production integrity and duplicate-action guards for the live Solamentis schema.
-- Applied to Supabase project yyeidanzflitrstvooxw as migration
-- 20260907141232_workspace_asset_billing_integrity_guards.

BEGIN;

DROP INDEX IF EXISTS public.generation_outputs_job_variant_idx;

CREATE UNIQUE INDEX IF NOT EXISTS projects_user_name_ci_key
  ON public.projects (user_id, lower(btrim(name)));

CREATE UNIQUE INDEX IF NOT EXISTS assets_user_storage_path_key
  ON public.assets (user_id, storage_path);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_external_subscription_id_key
  ON public.subscriptions (external_subscription_id)
  WHERE external_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_external_checkout_session_id_key
  ON public.subscriptions (external_checkout_session_id)
  WHERE external_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS billing_transactions_provider_payment_intent_key
  ON public.billing_transactions (provider, stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS billing_transactions_provider_invoice_key
  ON public.billing_transactions (provider, stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

COMMIT;
