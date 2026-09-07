-- Applied live migration: 20260907141232_workspace_asset_billing_integrity_guards
-- See the canonical migration file in supabase/migrations for the exact live DDL.
--
-- Snapshot source: Supabase project yyeidanzflitrstvooxw (Postgres 17.6.1.166)
-- Snapshot date: 2026-09-07
-- Application tables: 32 (31 public + private.runtime_secrets)
-- Production row data and secrets are intentionally excluded.
-- Supabase-managed auth/storage/vault/pgmq objects are dependencies and are not recreated here.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS private;

-- Tables and columns are represented by the live canonical definitions below.
CREATE TABLE public.ai_feature_routes (plan_id text NOT NULL, category text NOT NULL, quality text NOT NULL, provider_id text NOT NULL, model_id uuid NOT NULL, enabled boolean NOT NULL DEFAULT true, fallback_provider_id text, fallback_model_id uuid, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ai_models (id uuid NOT NULL DEFAULT gen_random_uuid(), provider_id text NOT NULL, model_key text NOT NULL, display_name text NOT NULL, enabled boolean NOT NULL DEFAULT false, supports_generate boolean NOT NULL DEFAULT true, supports_edit boolean NOT NULL DEFAULT false, supports_reference_images boolean NOT NULL DEFAULT false, max_input_images integer NOT NULL DEFAULT 0, supported_sizes text[] NOT NULL DEFAULT array['1K'::text], metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ai_plan_routes (plan_id text NOT NULL, quality text NOT NULL, provider_id text NOT NULL, model_id uuid NOT NULL, enabled boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now(), fallback_provider_id text, fallback_model_id uuid);
CREATE TABLE public.ai_providers (id text NOT NULL, display_name text NOT NULL, enabled boolean NOT NULL DEFAULT false, secret_env text NOT NULL, base_url text, health_status text NOT NULL DEFAULT 'unknown'::text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), secret_name text, protocol text NOT NULL DEFAULT 'generic_json'::text, request_config jsonb NOT NULL DEFAULT '{}'::jsonb, timeout_ms integer NOT NULL DEFAULT 120000, health_checked_at timestamptz, health_latency_ms integer, health_message text, health_failures integer NOT NULL DEFAULT 0, capabilities jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE public.assets (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, project_id uuid, kind text NOT NULL, storage_path text NOT NULL, mime_type text NOT NULL, byte_size bigint NOT NULL, width integer, height integer, checksum text, status text NOT NULL DEFAULT 'ready'::text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.audit_logs (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid, actor_type text NOT NULL, action text NOT NULL, resource_type text, resource_id uuid, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.billing_events (id uuid NOT NULL DEFAULT gen_random_uuid(), provider text NOT NULL, event_id text NOT NULL, event_type text NOT NULL, payload_hash text NOT NULL, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'processed'::text, error_message text, received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz);
CREATE TABLE public.billing_transactions (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, provider text NOT NULL DEFAULT 'stripe'::text, kind text NOT NULL, status text NOT NULL DEFAULT 'paid'::text, plan_id text, product_id text, description text, amount_minor bigint NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'USD'::text, country_code text, stripe_checkout_session_id text, stripe_payment_intent_id text, stripe_invoice_id text, stripe_customer_id text, stripe_subscription_id text, external_event_id text, receipt_url text, purchased_at timestamptz NOT NULL DEFAULT now(), period_start timestamptz, period_end timestamptz, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.brand_kits (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL DEFAULT 'Default brand kit'::text, config jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.credit_grants (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, amount bigint NOT NULL, source text NOT NULL, idempotency_key text NOT NULL, external_reference text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), remaining_amount bigint NOT NULL DEFAULT 0, expires_at timestamptz, expired_at timestamptz);
CREATE TABLE public.credit_ledger (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, job_id uuid, kind text NOT NULL, amount bigint NOT NULL, balance_after bigint NOT NULL, idempotency_key text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.credit_product_prices (product_id text NOT NULL, country_code text NOT NULL, currency text NOT NULL, unit_amount_minor bigint NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.credit_products (id text NOT NULL, display_name text NOT NULL, credits bigint NOT NULL, unit_amount_minor integer NOT NULL, currency text NOT NULL, active boolean NOT NULL DEFAULT true, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now(), sort_order integer NOT NULL DEFAULT 0);
CREATE TABLE public.credit_reservations (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, idempotency_key text NOT NULL, amount bigint NOT NULL, monthly_amount bigint NOT NULL DEFAULT 0, addon_amount bigint NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'reserved'::text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), finalized_at timestamptz);
CREATE TABLE public.detector_scans (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, asset_id uuid, status text NOT NULL DEFAULT 'queued'::text, ai_likelihood numeric, manipulation_likelihood numeric, provenance jsonb NOT NULL DEFAULT '{}'::jsonb, findings jsonb NOT NULL DEFAULT '[]'::jsonb, credits integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz);
CREATE TABLE public.generation_jobs (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, status text NOT NULL DEFAULT 'queued'::text, operation text NOT NULL, prompt text NOT NULL, size text NOT NULL, quality text NOT NULL, provider text NOT NULL, model text NOT NULL, reserved_credits bigint NOT NULL DEFAULT 0, idempotency_key text NOT NULL, external_job_id text, output_path text, error_code text, error_message text, created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, completed_at timestamptz, request jsonb NOT NULL DEFAULT '{}'::jsonb, project_id uuid, category text, requested_quality text);
CREATE TABLE public.generation_outputs (id uuid NOT NULL DEFAULT gen_random_uuid(), job_id uuid NOT NULL, asset_id uuid, variant text NOT NULL, storage_path text NOT NULL, mime_type text NOT NULL, width integer, height integer, byte_size bigint, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.job_failures (id uuid NOT NULL DEFAULT gen_random_uuid(), job_id uuid NOT NULL, attempt integer NOT NULL, error_code text, error_message text, provider_id text, model_key text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.notifications (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, kind text NOT NULL, title text NOT NULL, body text NOT NULL, severity text NOT NULL DEFAULT 'info'::text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, dedupe_key text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.plan_prices (id uuid NOT NULL DEFAULT gen_random_uuid(), plan_id text NOT NULL, country_code text NOT NULL, currency text NOT NULL, unit_amount_minor integer NOT NULL, "interval" text NOT NULL DEFAULT 'month'::text, stripe_price_id text, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.plans (id text NOT NULL, monthly_price_cents integer NOT NULL DEFAULT 0, monthly_credits bigint NOT NULL DEFAULT 0, max_uploads_per_project integer NOT NULL DEFAULT 1, watermark boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), max_uploads_per_month integer NOT NULL DEFAULT 1);
CREATE TABLE public.platform_specs (id text NOT NULL, display_name text NOT NULL, width integer NOT NULL, height integer NOT NULL, max_export_bytes bigint, allowed_mime_types text[] NOT NULL DEFAULT array['image/png'::text,'image/jpeg'::text,'image/webp'::text], metadata jsonb NOT NULL DEFAULT '{}'::jsonb, enabled boolean NOT NULL DEFAULT true);
CREATE TABLE public.pricing_regions (country_code text NOT NULL, currency text NOT NULL, currency_symbol text NOT NULL, locale text NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.profiles (id uuid NOT NULL, plan text NOT NULL DEFAULT 'free'::text, credits bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), plan_id text, credits_reserved bigint NOT NULL DEFAULT 0, role text NOT NULL DEFAULT 'user'::text, detected_country_code text, billing_country_code text, full_name text, email text, phone text, country_code text, country_name text, locale text, avatar_url text, last_seen_at timestamptz, last_login_at timestamptz, login_count integer NOT NULL DEFAULT 0, monthly_credits bigint NOT NULL DEFAULT 0, addon_credits bigint NOT NULL DEFAULT 0, credit_period_start date, credit_period_end date);
CREATE TABLE public.projects (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL DEFAULT 'Untitled project'::text, platform text NOT NULL DEFAULT 'custom'::text, width integer, height integer, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.provider_health_events (id uuid NOT NULL DEFAULT gen_random_uuid(), provider_id text NOT NULL, ok boolean NOT NULL, latency_ms integer, message text, capabilities jsonb NOT NULL DEFAULT '{}'::jsonb, checked_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.rate_limit_buckets (bucket_key text NOT NULL, window_started_at timestamptz NOT NULL, count integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.safety_events (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid, job_id uuid, asset_id uuid, policy_version integer, stage text NOT NULL, decision text NOT NULL, reasons jsonb NOT NULL DEFAULT '[]'::jsonb, score numeric, created_at timestamptz NOT NULL DEFAULT now(), provider_id text, model_key text);
CREATE TABLE public.safety_policies (id uuid NOT NULL DEFAULT gen_random_uuid(), version integer NOT NULL, status text NOT NULL DEFAULT 'draft'::text, rules jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), moderation_provider_id text, moderation_model_id uuid);
CREATE TABLE public.subscriptions (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, plan_id text NOT NULL, status text NOT NULL DEFAULT 'active'::text, provider text, external_customer_id text, external_subscription_id text, current_period_start timestamptz, current_period_end timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), country_code text, currency text, external_checkout_session_id text, cancel_at_period_end boolean NOT NULL DEFAULT false, metadata jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE public.templates (id uuid NOT NULL DEFAULT gen_random_uuid(), name text NOT NULL, platform text NOT NULL, width integer NOT NULL, height integer NOT NULL, config jsonb NOT NULL DEFAULT '{}'::jsonb, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.usage_periods (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, period_start date NOT NULL, period_end date NOT NULL, generations integer NOT NULL DEFAULT 0, detector_scans integer NOT NULL DEFAULT 0, uploads integer NOT NULL DEFAULT 0, credits_consumed bigint NOT NULL DEFAULT 0);
CREATE TABLE private.runtime_secrets (name text NOT NULL, secret text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), rotated_at timestamptz NOT NULL DEFAULT now());

-- Integrity, foreign keys, check constraints, unique constraints, indexes,
-- RLS policies, triggers and SECURITY DEFINER functions are tracked in the
-- ordered Supabase migrations. The following catalog queries reproduce the
-- remaining exact live definitions without copying production secrets/data.

ALTER TABLE public.ai_feature_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_plan_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detector_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_health_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_periods ENABLE ROW LEVEL SECURITY;

-- Current live non-constraint indexes, including the production duplicate guards.
CREATE INDEX ai_feature_routes_fallback_model_idx ON public.ai_feature_routes USING btree (fallback_model_id);
CREATE INDEX ai_feature_routes_fallback_provider_idx ON public.ai_feature_routes USING btree (fallback_provider_id);
CREATE INDEX ai_feature_routes_lookup_idx ON public.ai_feature_routes USING btree (category,quality,enabled);
CREATE INDEX ai_feature_routes_model_idx ON public.ai_feature_routes USING btree (model_id);
CREATE INDEX ai_feature_routes_provider_idx ON public.ai_feature_routes USING btree (provider_id);
CREATE INDEX ai_plan_routes_fallback_model_idx ON public.ai_plan_routes USING btree (fallback_model_id);
CREATE INDEX ai_plan_routes_fallback_provider_idx ON public.ai_plan_routes USING btree (fallback_provider_id);
CREATE INDEX ai_plan_routes_model_idx ON public.ai_plan_routes USING btree (model_id);
CREATE INDEX ai_plan_routes_provider_idx ON public.ai_plan_routes USING btree (provider_id);
CREATE INDEX ai_providers_enabled_idx ON public.ai_providers USING btree (enabled,protocol);
CREATE INDEX assets_job_metadata_idx ON public.assets USING btree (user_id,((metadata ->> 'job_id'::text)));
CREATE INDEX assets_project_created_idx ON public.assets USING btree (project_id,created_at DESC);
CREATE INDEX assets_user_created_idx ON public.assets USING btree (user_id,created_at DESC);
CREATE INDEX assets_user_status_created_idx ON public.assets USING btree (user_id,status,created_at DESC);
CREATE UNIQUE INDEX assets_user_storage_path_key ON public.assets USING btree (user_id,storage_path);
CREATE INDEX audit_logs_created_idx ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX audit_logs_user_idx ON public.audit_logs USING btree (user_id);
CREATE INDEX billing_events_received_idx ON public.billing_events USING btree (received_at DESC);
CREATE INDEX billing_transactions_product_id_idx ON public.billing_transactions USING btree (product_id);
CREATE UNIQUE INDEX billing_transactions_provider_invoice_key ON public.billing_transactions USING btree (provider,stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
CREATE UNIQUE INDEX billing_transactions_provider_payment_intent_key ON public.billing_transactions USING btree (provider,stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX billing_transactions_subscription_idx ON public.billing_transactions USING btree (stripe_subscription_id,purchased_at DESC);
CREATE INDEX billing_transactions_user_created_idx ON public.billing_transactions USING btree (user_id,created_at DESC);
CREATE INDEX billing_transactions_user_purchased_idx ON public.billing_transactions USING btree (user_id,purchased_at DESC);
CREATE INDEX brand_kits_user_idx ON public.brand_kits USING btree (user_id);
CREATE INDEX credit_grants_expiry_idx ON public.credit_grants USING btree (user_id,expires_at,remaining_amount) WHERE remaining_amount > 0;
CREATE INDEX credit_grants_user_created_idx ON public.credit_grants USING btree (user_id,created_at DESC);
CREATE UNIQUE INDEX credit_ledger_idempotency_unique_idx ON public.credit_ledger USING btree (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX credit_ledger_job_idx ON public.credit_ledger USING btree (job_id);
CREATE INDEX credit_ledger_user_created_idx ON public.credit_ledger USING btree (user_id,created_at DESC);
CREATE UNIQUE INDEX credit_ledger_user_idem_idx ON public.credit_ledger USING btree (user_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX credit_product_prices_country_idx ON public.credit_product_prices USING btree (country_code,active,product_id);
CREATE INDEX credit_reservations_user_status_idx ON public.credit_reservations USING btree (user_id,status,created_at DESC);
CREATE INDEX detector_scans_asset_idx ON public.detector_scans USING btree (asset_id);
CREATE INDEX detector_scans_user_idx ON public.detector_scans USING btree (user_id);
CREATE INDEX generation_jobs_phase1_route_idx ON public.generation_jobs USING btree (category,requested_quality,status,created_at DESC);
CREATE INDEX generation_jobs_project_created_idx ON public.generation_jobs USING btree (project_id,created_at DESC);
CREATE INDEX generation_jobs_request_gin_idx ON public.generation_jobs USING gin (request);
CREATE INDEX generation_jobs_status_created_idx ON public.generation_jobs USING btree (status,created_at);
CREATE INDEX generation_jobs_user_created_idx ON public.generation_jobs USING btree (user_id,created_at DESC);
CREATE INDEX generation_jobs_user_project_created_idx ON public.generation_jobs USING btree (user_id,project_id,created_at DESC);
CREATE INDEX generation_outputs_asset_idx ON public.generation_outputs USING btree (asset_id);
CREATE INDEX job_failures_job_created_idx ON public.job_failures USING btree (job_id,created_at DESC);
CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id,created_at DESC);
CREATE INDEX notifications_user_unread_idx ON public.notifications USING btree (user_id,read_at,created_at DESC);
CREATE INDEX plan_prices_country_active_idx ON public.plan_prices USING btree (country_code,active);
CREATE INDEX profiles_billing_country_code_idx ON public.profiles USING btree (billing_country_code);
CREATE INDEX profiles_country_idx ON public.profiles USING btree (country_code);
CREATE INDEX profiles_detected_country_code_idx ON public.profiles USING btree (detected_country_code);
CREATE INDEX profiles_email_idx ON public.profiles USING btree (email);
CREATE INDEX profiles_last_seen_idx ON public.profiles USING btree (last_seen_at DESC);
CREATE INDEX profiles_plan_id_idx ON public.profiles USING btree (plan_id);
CREATE INDEX profiles_role_idx ON public.profiles USING btree (role);
CREATE UNIQUE INDEX projects_user_name_ci_key ON public.projects USING btree (user_id,lower(btrim(name)));
CREATE INDEX projects_user_updated_idx ON public.projects USING btree (user_id,updated_at DESC);
CREATE INDEX provider_health_events_provider_checked_idx ON public.provider_health_events USING btree (provider_id,checked_at DESC);
CREATE INDEX safety_events_asset_idx ON public.safety_events USING btree (asset_id);
CREATE INDEX safety_events_job_idx ON public.safety_events USING btree (job_id);
CREATE INDEX safety_events_provider_created_idx ON public.safety_events USING btree (provider_id,created_at DESC);
CREATE INDEX safety_events_user_created_idx ON public.safety_events USING btree (user_id,created_at DESC);
CREATE INDEX safety_policies_moderation_model_idx ON public.safety_policies USING btree (moderation_model_id);
CREATE INDEX safety_policies_moderation_provider_idx ON public.safety_policies USING btree (moderation_provider_id);
CREATE INDEX subscriptions_country_code_idx ON public.subscriptions USING btree (country_code);
CREATE UNIQUE INDEX subscriptions_external_checkout_session_id_key ON public.subscriptions USING btree (external_checkout_session_id) WHERE external_checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX subscriptions_external_subscription_id_key ON public.subscriptions USING btree (external_subscription_id) WHERE external_subscription_id IS NOT NULL;
CREATE INDEX subscriptions_plan_idx ON public.subscriptions USING btree (plan_id);

-- Exact live policy/function/trigger definitions can be exported with:
-- SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public';
-- SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.prokind='f';
-- SELECT pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname='public';

COMMIT;
