# Solamentis implementation status

## Implemented

- Next.js + TypeScript foundation
- Node 24 CI/runtime target with lint/typecheck/build verification
- Phase 1 commercial plans: Free 5 monthly credits, Pro 50, Business 100
- Phase 1 generation credit costs: Basic 1, Medium 5, Ultra 10
- Phase 1 upload quotas: Free 2/month, Pro 5/month, Business 20/month, with matching hard project caps
- Configuration-driven plans and platform specs
- Live Supabase provider/model routing tables
- Google Gemini image adapter using current image-generation API
- Configuration-driven `generic_json` provider adapter for compatible image APIs
- Provider protocol/base URL/request/response mapping stored in Supabase
- Provider/model/API-key switching through configuration/admin API without rewriting application code for supported protocols
- Runtime route resolution from the captured generation job plan
- Configured fallback-provider routing for retryable provider failures
- Persistent provider health status and health history
- Model-aware provider health checks
- Authenticated generation endpoint
- Atomic per-user generation rate limiting
- Transactional credit reserve/finalize/refund contracts
- Failure-safe generation credit reservation lifecycle
- Idempotent generation jobs
- Supabase durable generation queue
- Protected queue worker endpoint and Vercel cron trigger
- Durable job-failure records
- Supabase Vault provider-secret fallback
- Supabase secret API-key compatibility with legacy service-role fallback during migration
- Signed private upload issuance
- Upload issuance rate limiting and strict client metadata validation
- Server-enforced monthly and per-project plan upload limits
- Uploaded-image structural validation based on actual stored bytes
- Uploaded-image SHA-256 checksum persistence
- Vision-based moderation for uploaded/generated images with versioned policy selection
- Moderation decisions persisted with provider/model attribution
- Blocked/review assets cannot receive signed download URLs
- Private signed download URLs
- Sharp-based preview/editor/export resizing and compression
- Free-plan watermark compositing with safe text handling
- Project creation/list/detail/update/delete APIs
- Platform-aware project dimension validation
- Project deletion storage cleanup
- Generation jobs linked to owned projects
- Project-scoped asset and generation history retrieval
- Versioned safety-event persistence for generation requests and image moderation
- Active safety-policy version loading from Supabase
- Explicit safety-policy HTTP responses
- Supabase Edge Functions deployed: `health`, `provider-health`, `pricing`, `image-moderation`, `generation-worker`, `billing-webhook`
- Supabase Edge Function source tracked under `supabase/functions/`
- Country-aware pricing data model for five initial markets: IN, US, BD, GB, AE
- Country/currency/locale pricing endpoint using country headers or explicit country selection
- Secure Stripe checkout API for paid plans and the Phase 1 50-credit/$5 top-up
- Checkout rate limiting and Stripe request idempotency keys
- Credit wallet UI on dashboard, sidebar, header, billing page, and live usage modal
- Purchased-credit balance stored separately from monthly credits and never expired
- Atomic purchased-credit grant RPC with ledger/grant idempotency
- Atomic paid-plan activation/renewal RPC with monthly credit period tracking
- Billing webhook with Stripe signature validation, replay-safe persistence, subscription activation/renewal, add-on credit grants, cancellation handling, and payment-failure state
- Monthly/per-project upload quota UI and server enforcement
- Minimal login/signup/create UI
- Server-side admin provider and AI-route configuration endpoints
- Audit-log writes for provider configuration changes
- CI workflow for lint/typecheck/build
- Supabase RLS/security hardening and foreign-key indexes
- Explicit deny-by-default policies for internal operational tables, including credit grants and reservations

## Verified live Supabase Phase 1 state

- Project `yyeidanzflitrstvooxw` is the active Solamentis Supabase project
- `plans` table matches Phase 1: Free 5 credits / 2 uploads per month and per project, Pro 50 / 5, Business 100 / 20
- `credit_products` contains active `addon_50_usd`: 50 credits for $5 USD, `expires=false`
- `grant_addon_credits(uuid,bigint,text,text,jsonb)` and `activate_paid_plan(uuid,text,timestamptz,timestamptz,text,jsonb)` exist as service-role-only RPCs
- `credit_grants` and `credit_reservations` have explicit deny-by-default RLS policies and no direct anon/authenticated table privileges
- Security advisor no longer reports the two credit-table RLS policy findings
- Remaining security advisor warning: leaked password protection is disabled in Supabase Auth and must be enabled in the Supabase Auth dashboard
- Live `billing-webhook` is ACTIVE at version 5 with JWT verification disabled because it performs Stripe signature verification itself

## Not yet launch-complete

- Configure and verify production Stripe secret/webhook secrets and complete a real $5 top-up + subscription end-to-end test
- Production subscription price IDs are optional with the current dynamic-price fallback, but should be created and pinned before scale
- Automated country-specific tax/VAT/GST handling and tax evidence policy
- Edge-to-production generation worker bridge secrets and deployed Vercel app URL
- Provider capability discovery beyond basic health checks
- Operational exponential retry backoff/dead-letter queue and alerting
- Detector implementation
- Full editor/canvas workflows
- Full templates and brand-kit workflows
- Full admin UI for providers, models, routes, safety, plans, users, and audit history
- IP/account/upload/API abuse controls beyond account-scoped rate limits
- Full observability dashboards, metrics, tracing, alerts, and error tracking
- Comprehensive unit/integration/e2e/security/safety/concurrency test suite
- Production provider credentials configured and verified end-to-end
- Vercel production project and end-to-end smoke test with a real provider key
- Generated master-asset lifecycle/cleanup and complete upload-derivative pipeline
- Atomic provider-health counters under high concurrency
- Cost telemetry, provider spend budgets, and per-feature gross-margin controls
- Backup/PITR restore drill, load/stress testing, and disaster-recovery verification
- Reproducible dependency lockfile and npm-ci workflow
- Image-analysis runtime currently uses the OpenRouter-specific implementation while the database also contains Google image-analysis routes; provider routing should be unified before claiming fully configuration-driven analysis
- Image-edit runtime still has a legacy `ai_plan_routes` dependency; those legacy routes are disabled in the live database, so edit operations require further Phase 1 route unification
- Migration from legacy Supabase service-role/anon key names to publishable/secret keys before the end-of-2026 deprecation window

## Important provider rule

The application is provider-independent at the business-logic level. A provider that conforms to an existing runtime protocol can be added or changed by configuration: provider id, protocol, endpoint, credential, request template, response paths, and model routes. A genuinely incompatible protocol still requires one small adapter implementation, but the generation jobs, credits, storage, safety pipeline, editor, and product core do not need to be rewritten.
